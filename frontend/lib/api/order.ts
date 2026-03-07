import { apiClient } from './client';

export const orderApi = {
  create: (flashSaleId: string) =>
    apiClient.post('/orders', { flashSaleId }).then((r) => r.data),

  getMyOrders: () =>
    apiClient.get('/orders/my').then((r) => r.data),
};