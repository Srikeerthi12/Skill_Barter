import api from './axios';

export const listRequestsApi = () => api.get('/exchanges');
export const listLearningApi = () => api.get('/exchanges/learning');
export const createRequestApi = (payload) => api.post('/exchanges', payload);
export const respondRequestApi = (id, payload) => api.patch(`/exchanges/${id}/respond`, payload);
