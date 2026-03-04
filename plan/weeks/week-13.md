# Week 13 — Search với Elasticsearch

> **Phase:** 4 — Advanced Systems
> **Summary:** Full-text search là requirement phổ biến trong production apps. Tuần này implement search cho FlashDeal bằng Elasticsearch — từ basic text search đến fuzzy matching, faceted search, và search analytics. Học luôn khi nào nên dùng Elasticsearch vs PostgreSQL full-text search.

---

## 🎯 Goal cuối tuần
- [ ] Product search với Elasticsearch hoạt động
- [ ] Relevance scoring tuned phù hợp
- [ ] Autocomplete suggestions
- [ ] Syncing ES với PostgreSQL

---

## Day 1 (Thứ 2) — Elasticsearch Fundamentals

### Buổi sáng: Elasticsearch vs PostgreSQL FTS

| | PostgreSQL FTS | Elasticsearch |
|---|---|---|
| Setup | Đã có sẵn | Cần thêm service |
| Query | `tsvector`, `tsquery` | JSON DSL |
| Relevance | Cơ bản | Rất mạnh (BM25) |
| Scalability | Tốt | Tốt hơn ở scale lớn |
| Fuzzy search | Limited | Built-in |
| Suggestions | Không | Built-in |
| Dùng khi | Simple search, small data | Complex search, large data |

**Cho FlashDeal:**
- Products < 100k → PostgreSQL FTS đủ
- Products > 1M, cần fuzzy, autocomplete → Elasticsearch

### Buổi chiều: Core Concepts

```
Index (like DB table): chứa documents
Document (like row): data unit (JSON)
Field (like column): data field
Shard: horizontal partition của index
Replica: copy của shard cho HA

Inverted Index:
  "iphone 14" → term: [iphone, 14]
  iphone → [doc1, doc5, doc12]
  14 → [doc1, doc3, doc5]
  
  Search "iphone" → O(1) lookup → [doc1, doc5, doc12]
```

- [ ] Setup Elasticsearch trong Docker Compose (xem config bên dưới)
- [ ] Tạo `products` index
- [ ] Index sample data
- [ ] Basic search query

### Docker Compose config cho Elasticsearch

Thêm vào `docker-compose.yml`:

```yaml
elasticsearch:
  image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
  container_name: flashdeal_elasticsearch
  environment:
    - discovery.type=single-node
    - xpack.security.enabled=false   # tắt auth cho local dev
    - ES_JAVA_OPTS=-Xms512m -Xmx512m # giới hạn RAM, mặc định ES dùng 4GB+
  ports:
    - "9200:9200"
  volumes:
    - es_data:/usr/share/elasticsearch/data
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:9200"]
    interval: 30s
    timeout: 10s
    retries: 5

kibana:   # GUI cho Elasticsearch — optional nhưng rất hữu ích
  image: docker.elastic.co/kibana/kibana:8.11.0
  container_name: flashdeal_kibana
  environment:
    - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
  ports:
    - "5601:5601"
  depends_on:
    - elasticsearch
```

Thêm vào `volumes:` ở cuối file:
```yaml
volumes:
  es_data:   # thêm dòng này
```

**Kibana UI:** http://localhost:5601 — dùng để test query, xem indices, xem data.

---

### ⚠️ Windows gotchas (phải làm trước khi chạy)

**Gotcha 1: vm.max_map_count quá thấp**

ES cần kernel setting này. Trên Windows + WSL2, mặc định là 65530, ES cần 262144.

Kiểm tra:
```bash
# Chạy trong WSL2 terminal (không phải PowerShell)
cat /proc/sys/vm/max_map_count
# Nếu < 262144 → fix:
sudo sysctl -w vm.max_map_count=262144
```

Để fix vĩnh viễn, tạo file `C:\Users\<tên>\wsl.conf` trong WSL2:
```
# Trong WSL2:
echo 'vm.max_map_count=262144' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

Hoặc tạo file `.wslconfig` trong `C:\Users\<tên>\.wslconfig`:
```ini
[wsl2]
kernelCommandLine = sysctl.vm.max_map_count=262144
```
Sau đó restart WSL: `wsl --shutdown` rồi mở lại.

**Gotcha 2: RAM**

ES mặc định dùng 50% RAM của máy. Với `ES_JAVA_OPTS=-Xms512m -Xmx512m` trong docker-compose thì giới hạn còn 512MB — đủ để học.

Nếu container bị kill (exit code 137) → OOM killer → tăng lên `-Xms1g -Xmx1g`.

**Gotcha 3: ES 8.x security mặc định bật**

Nếu không có `xpack.security.enabled=false`, ES sẽ yêu cầu HTTPS + username/password.
Config trên đã tắt rồi. Nếu thấy lỗi `SSL required` hoặc `401` khi gọi API → check lại env var này.

---

### Verify ES chạy được
```bash
curl http://localhost:9200
# Expected:
# { "name" : "...", "cluster_name" : "docker-cluster", "version": {...} }

curl http://localhost:9200/_cat/indices?v
# List tất cả indices
```

---

### License của Elasticsearch

ES **miễn phí hoàn toàn** cho local dev và self-hosted:
- **Basic license** (free): full-text search, security basics, Kibana — đủ cho học và production nhỏ
- **Platinum/Enterprise** (trả phí): ML features, advanced security, cross-cluster replication
- **Elastic Cloud** (trả phí): hosted version do Elastic quản lý

Mày dùng Docker local = Basic license = free, không cần đăng ký gì.

**Alternative nếu máy yếu:** OpenSearch (AWS fork, Apache 2.0 license, API tương thích):
```yaml
elasticsearch:
  image: opensearchproject/opensearch:2.11.0
  environment:
    - discovery.type=single-node
    - DISABLE_SECURITY_PLUGIN=true
    - OPENSEARCH_JAVA_OPTS=-Xms512m -Xmx512m
```

---

## Day 2 (Thứ 3) — Indexing & Mapping

### Buổi sáng: Mapping Design

```json
{
  "mappings": {
    "properties": {
      "name": {
        "type": "text",
        "analyzer": "standard",
        "fields": {
          "keyword": { "type": "keyword" },
          "suggest": { "type": "search_as_you_type" }
        }
      },
      "description": { "type": "text" },
      "price": { "type": "float" },
      "category": { "type": "keyword" },
      "tags": { "type": "keyword" },
      "inStock": { "type": "boolean" },
      "createdAt": { "type": "date" }
    }
  }
}
```

**field `keyword` vs `text`:**
- `text`: full-text search, analyzed (tokenized)
- `keyword`: exact match, aggregations, sorting

### Buổi chiều: Analyzers

```
Custom analyzer cho Vietnamese/English:
  "Smart Phone" → tokenize → ["smart", "phone"]
  → lowercase → ["smart", "phone"]
  → remove stopwords → ["smart", "phone"]
  → stemming → ["smart", "phone"] (no change here)
```

- [ ] Configure Vietnamese-friendly analyzer
- [ ] Test analysis: `POST /_analyze`

---

## Day 3 (Thứ 4) — Search Queries

### Buổi sáng: Query Types

**Match Query (full-text):**
```json
{
  "query": {
    "match": {
      "name": "iphone 15 pro"  // analyzed, OR by default
    }
  }
}
```

**Multi-match:**
```json
{
  "query": {
    "multi_match": {
      "query": "iphone 15",
      "fields": ["name^3", "description"],  // name boosted 3x
      "type": "best_fields"
    }
  }
}
```

**Bool Query (combine):**
```json
{
  "query": {
    "bool": {
      "must": [{ "match": { "name": "iphone" } }],
      "filter": [
        { "term": { "category": "electronics" } },
        { "range": { "price": { "gte": 100, "lte": 1000 } } }
      ]
    }
  }
}
```

### Buổi chiều: Implement Search API

- [ ] `GET /search/products?q=iphone&category=electronics&minPrice=100&maxPrice=1000`
- [ ] Pagination với `from/size`
- [ ] Highlighting matched terms:
  ```json
  {
    "highlight": {
      "fields": { "name": {}, "description": {} }
    }
  }
  ```

---

## Day 4 (Thứ 5) — Fuzzy Search & Autocomplete

### Buổi sáng: Fuzzy Search

```json
{
  "query": {
    "fuzzy": {
      "name": {
        "value": "iphon",  // typo: iphon → iphone
        "fuzziness": "AUTO"
      }
    }
  }
}
```

**Fuzziness:**
- `0`: exact match
- `1`: 1 edit distance (thêm/xóa/sửa 1 char)
- `2`: 2 edit distance
- `AUTO`: tự chọn dựa vào string length

### Buổi chiều: Autocomplete

```typescript
// search_as_you_type field type
// "ipho" → suggest ["iphone", "iphone 14", "iphone 15 pro"]

const result = await es.search({
  index: 'products',
  body: {
    query: {
      multi_match: {
        query: 'ipho',
        type: 'bool_prefix',
        fields: ['name.suggest', 'name.suggest._2gram', 'name.suggest._3gram']
      }
    }
  }
})
```

- [ ] Implement autocomplete endpoint
- [ ] NextJS: search input với debounced autocomplete

---

## Day 5 (Thứ 6) — DB Sync Strategy

### Buổi sáng: Problem — Keeping ES in Sync

```
PostgreSQL = source of truth
Elasticsearch = search index

Khi product thay đổi → ES cần update

Options:
1. Dual write: app write DB + ES đồng thời
   Vấn đề: partial failure, eventual inconsistency

2. Change Data Capture (CDC): 
   DB → binlog/WAL → Debezium → ES
   Reliable nhưng complex

3. Event-driven:
   Update DB → emit event → ES handler update
   Simple, eventual consistency

4. Batch sync (background job mỗi N phút)
   Simple, lag N phút
```

### Buổi chiều: Implement Event-driven Sync

```typescript
// Khi product update:
@OnEvent('product.updated')
async syncToElasticsearch(product: Product) {
  await this.es.index({
    index: 'products',
    id: product.id.toString(),
    body: this.transformProductForES(product),
  })
}

@OnEvent('product.deleted')
async removeFromES(payload: { id: number }) {
  await this.es.delete({ index: 'products', id: payload.id.toString() })
}
```

- [ ] Implement sync cho create, update, delete
- [ ] Initial sync: mọi product từ DB → ES
- [ ] Handle ES down: queue updates, retry khi up

---

## Day 6 (Thứ 7) — Search Analytics

### Faceted Search (Aggregations):

```json
{
  "aggs": {
    "by_category": {
      "terms": { "field": "category" }
    },
    "price_ranges": {
      "range": {
        "field": "price",
        "ranges": [
          { "to": 100 },
          { "from": 100, "to": 500 },
          { "from": 500 }
        ]
      }
    }
  }
}
```

- [ ] Search API trả về facets:
  ```json
  {
    "hits": [...],
    "facets": {
      "categories": [{"name": "electronics", "count": 45}],
      "priceRanges": [...]
    }
  }
  ```
- [ ] NextJS: filter sidebar với facets

---

## Day 7 (Chủ Nhật) — Review

**Tự trả lời:**
1. Elasticsearch vs Database — khi nào dùng cái nào?
2. Inverted index là gì, tại sao search nhanh?
3. `text` vs `keyword` type khác nhau thế nào?
4. Khi DB update → ES update out of sync 2 giây — có acceptable không?

---

## 📚 Tài liệu tham khảo
- [Elasticsearch Guide](https://www.elastic.co/guide/en/elasticsearch/reference/current/)
- [Elasticsearch NestJS](https://docs.nestjs.com/techniques/elasticsearch)
- [ES Mapping Best Practices](https://www.elastic.co/blog/found-elasticsearch-mapping-introduction)

---

*← [Week 12](./week-12.md) | [Week 14 →](./week-14.md)*
