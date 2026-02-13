import api from './axios';

export const listRequestsApi = () => api.get('/exchanges');
export const listLearningApi = () => api.get('/exchanges/learning');
export const listTeachingApi = () => api.get('/exchanges/teaching');
export const listChatConversationsApi = () => api.get('/exchanges/chats');
export const createRequestApi = (payload) => api.post('/exchanges', payload);
export const respondRequestApi = (id, payload) => api.patch(`/exchanges/${id}/respond`, payload);
export const completeExchangeApi = (id) => api.patch(`/exchanges/${id}/complete`);
export const listExchangeMessagesApi = (id, { limit = 30, offset = 0 } = {}) =>
	api.get(`/exchanges/${id}/messages`, { params: { limit, offset } });
export const sendExchangeMessageApi = (id, payload) => api.post(`/exchanges/${id}/messages`, payload);
export const sendExchangeMessageUploadApi = (id, formData) =>
	api.post(`/exchanges/${id}/messages/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const markExchangeReadApi = (id) => api.post(`/exchanges/${id}/messages/read`);
export const toggleMessageReactionApi = (exchangeId, messageId, emoji) =>
	api.post(`/exchanges/${exchangeId}/messages/${messageId}/reactions`, { emoji });
export const getExchangeFeedbackApi = (id) => api.get(`/exchanges/${id}/feedback`);
export const upsertExchangeFeedbackApi = (id, payload) => api.post(`/exchanges/${id}/feedback`, payload);
