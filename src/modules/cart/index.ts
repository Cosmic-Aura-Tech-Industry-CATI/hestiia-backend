// Canonical Module: Cart
export * from './interfaces/cart.interface.js';
export * from './models/cart.model.js';
export * from './services/cart.service.js';
export * from './controllers/cart.controller.js';
export { default as modularCartRouter } from './routes/cart.routes.js';

// Base Cart implementation
export * as flatCartInterface from './cart.interface.js';
export { cartService as baseCartService } from './cart.service.js';
export * as flatCartController from './cart.controller.js';
export { cartRouter, cartRouter as default } from './cart.router.js';
