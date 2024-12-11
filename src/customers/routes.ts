import express from 'express';
import { addCustomer, deleteCustomer, getCustomer, getCustomers, updateCustomer,  } from './controllers';
const router = express.Router(); 

router
    .post('/', addCustomer)           // Create new customer
    .get('/', getCustomers)           // Get all customers
    .get('/:id', getCustomer)         // Get single customer
    .put('/:id', updateCustomer)      // Update a customer
    .delete('/:id', deleteCustomer)   // Delete a customer

export { router as customerRouter }