import { apiClient } from './client';

export const flashSaleApi = {
  getActive: () =>
    apiClient.get('/flash-sales/active').then((r) => r.data),

  getById: (id: string) =>
    apiClient.get(`/flash-sales/${id}`).then((r) => r.data),
};