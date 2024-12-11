"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addCustomer = addCustomer;
exports.getCustomers = getCustomers;
exports.getCustomer = getCustomer;
exports.updateCustomer = updateCustomer;
exports.deleteCustomer = deleteCustomer;
const prisma_1 = require("../lib/prisma");
function addCustomer(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { firstName, lastName, businessName, phone, email, customerType, address } = req.body;
            //Validate customer data 
            if (!customerType) {
                res.status(401).json({ message: 'Specify customer type' });
                return;
            }
            if (customerType === 'individual' && !firstName) {
                res.status(401).json({ message: 'First name required' });
                return;
            }
            if (customerType === 'business' && !businessName) {
                res.status(401).json({ message: 'Business name required' });
                return;
            }
            // Save to database 
            yield prisma_1.prisma.customer.create({
                data: {
                    first_name: firstName,
                    last_name: lastName,
                    business_name: businessName,
                    email,
                    phone: phone,
                    address,
                    customer_type: customerType
                }
            });
            res.status(201).json({ message: 'Customer added' });
        }
        catch (err) {
            console.log(err);
            res.status(500).json({ message: 'Server error' });
        }
    });
}
function getCustomers(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const fetchCustomers = yield prisma_1.prisma.customer.findMany({
                orderBy: {
                    created_at: 'desc'
                }
            });
            const customers = fetchCustomers.map(customer => ({
                id: customer.id,
                customerName: customer.customer_type === 'individual' ? `${customer.first_name} ${customer.last_name}` : `${customer.business_name}`,
                email: customer.email,
                phone: customer.phone,
                address: customer.address,
                createdAt: customer.created_at
            }));
            res.status(200).json(customers);
        }
        catch (err) {
            console.log(err);
            res.status(500).json({ message: 'Server error' });
        }
    });
}
function getCustomer(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            const customer = yield prisma_1.prisma.customer.findUnique({
                where: {
                    id: parseInt(id)
                }
            });
            if (!customer) {
                res.status(404).json({ message: 'Customer not found' });
                return;
            }
            res.status(200).json(customer);
        }
        catch (err) {
            console.log(err);
            res.status(500).json({ message: 'Server error' });
        }
    });
}
function updateCustomer(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            const { firstName, lastName, businessName, phone, email, customer_type, address } = req.body;
            // Check if customer exists
            const existingCustomer = yield prisma_1.prisma.customer.findUnique({
                where: {
                    id: parseInt(id)
                }
            });
            if (!existingCustomer) {
                res.status(404).json({ message: 'Customer not found' });
                return;
            }
            // Validate customer data
            if (customer_type && !['individual', 'business'].includes(customer_type)) {
                res.status(400).json({ message: 'Invalid customer type' });
                return;
            }
            if (customer_type === 'individual' && !firstName) {
                res.status(400).json({ message: 'First name required for individual customers' });
                return;
            }
            if (customer_type === 'business' && !businessName) {
                res.status(400).json({ message: 'Business name required for business customers' });
                return;
            }
            // Update customer
            const updatedCustomer = yield prisma_1.prisma.customer.update({
                where: {
                    id: parseInt(id)
                },
                data: {
                    first_name: firstName,
                    last_name: lastName,
                    business_name: businessName,
                    email,
                    phone,
                    address,
                    customer_type,
                    updated_at: new Date()
                }
            });
            res.status(200).json({
                message: 'Customer updated',
                customer: updatedCustomer
            });
        }
        catch (err) {
            console.log(err);
            res.status(500).json({ message: 'Server error' });
        }
    });
}
function deleteCustomer(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            // Check if customer exists
            const existingCustomer = yield prisma_1.prisma.customer.findUnique({
                where: {
                    id: parseInt(id)
                }
            });
            if (!existingCustomer) {
                res.status(404).json({ message: 'Customer not found' });
                return;
            }
            // Delete customer
            yield prisma_1.prisma.customer.delete({
                where: {
                    id: parseInt(id)
                }
            });
            res.status(200).json({ message: 'Customer deleted successfully' });
        }
        catch (err) {
            console.log(err);
            res.status(500).json({ message: 'Server error' });
        }
    });
}
