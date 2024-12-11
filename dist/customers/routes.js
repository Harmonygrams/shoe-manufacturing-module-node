"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.customerRouter = void 0;
const express_1 = __importDefault(require("express"));
const controllers_1 = require("./controllers");
const router = express_1.default.Router();
exports.customerRouter = router;
router
    .post('/', controllers_1.addCustomer) // Create new customer
    .get('/', controllers_1.getCustomers) // Get all customers
    .get('/:id', controllers_1.getCustomer) // Get single customer
    .put('/:id', controllers_1.updateCustomer) // Update a customer
    .delete('/:id', controllers_1.deleteCustomer); // Delete a customer
