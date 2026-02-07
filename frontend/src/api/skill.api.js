import api from './axios';

export const listSkillsApi = () => api.get('/skills');
export const createSkillApi = (payload) => api.post('/skills', payload);

export const getSkillApi = (id) => api.get(`/skills/${id}`);
export const updateSkillApi = (id, payload) => api.put(`/skills/${id}`, payload);
export const deleteSkillApi = (id) => api.delete(`/skills/${id}`);
