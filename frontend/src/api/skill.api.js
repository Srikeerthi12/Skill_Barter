import api from './axios';

export const listSkillsApi = () => api.get('/skills');
export const createSkillApi = (payload) => api.post('/skills', payload);

export const getSkillApi = (id) => api.get(`/skills/${id}`);
export const getSkillReviewsApi = (id, { limit = 10, offset = 0 } = {}) =>
	api.get(`/skills/${id}/reviews`, { params: { limit, offset } });
export const updateSkillApi = (id, payload) => api.put(`/skills/${id}`, payload);
export const deleteSkillApi = (id) => api.delete(`/skills/${id}`);
