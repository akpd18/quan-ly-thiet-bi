import { Router } from 'express';
import { getCatalog } from '../controllers/catalog.controller.js';
import { authenticate } from '../middlewares/auth.js';

const router = Router();

router.get('/', authenticate, getCatalog);

export default router;