import { Router } from 'express';
import { customerGalleryRouter } from './routes/customerGallery.routes.js';
import { adminGalleryRouter } from './routes/adminGallery.routes.js';

export { customerGalleryRouter, adminGalleryRouter };

const unifiedGalleryRouter = Router();

// Mount public / customer routes at root
unifiedGalleryRouter.use('/', customerGalleryRouter);

// Mount admin routes under /admin
unifiedGalleryRouter.use('/admin', adminGalleryRouter);

export default unifiedGalleryRouter;
