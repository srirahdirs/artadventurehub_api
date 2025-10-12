import express from 'express';
import { submitContactForm } from '../controllers/contactController.js';

const router = express.Router();

// Contact form submission
router.post('/', submitContactForm);

export default router;

