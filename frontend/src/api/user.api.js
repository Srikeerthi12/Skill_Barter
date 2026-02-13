import api from './axios';

export const getMyProfileApi = () => api.get('/users/me');
export const getPublicProfileApi = (id) => api.get(`/users/${id}`);

export const listUsersApi = () => api.get('/users');

export const getUserReviewsApi = (id, { limit = 10, offset = 0 } = {}) =>
	api.get(`/users/${id}/reviews`, { params: { limit, offset } });
