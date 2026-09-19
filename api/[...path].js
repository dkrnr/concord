import { handleRequest } from '../engine/server.js';

export default function handler(req, res) {
  return handleRequest(req, res);
}
