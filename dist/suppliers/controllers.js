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
exports.addSupplier = addSupplier;
exports.getSupplier = getSupplier;
exports.getSuppliers = getSuppliers;
exports.updateSupplier = updateSupplier;
exports.deleteSupplier = deleteSupplier;
const prisma_1 = require("../lib/prisma");
function addSupplier(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { firstName, lastName, businessName, phone, email, supplierType, address } = req.body;
            //Validate supplier data 
            if (!supplierType) {
                res.status(401).json({ message: 'Specify supplier type' });
                return;
            }
            if (supplierType === 'individual' && !firstName) {
                res.status(401).json({ message: 'First name required' });
                return;
            }
            if (supplierType === 'business' && !businessName) {
                res.status(401).json({ message: 'Business name required' });
                return;
            }
            // Save to database 
            yield prisma_1.prisma.supplier.create({
                data: {
                    first_name: firstName,
                    last_name: lastName,
                    business_name: businessName,
                    email,
                    phone: phone,
                    address,
                    supplier_type: supplierType
                }
            });
            res.status(201).json({ message: 'Supplier added' });
        }
        catch (err) {
            console.log(err);
            res.status(500).json({ message: 'Server error' });
        }
    });
}
function getSupplier(req, res) {
    return __awaiter(this, void 0, void 0, function* () { });
}
function getSuppliers(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const suppliers = yield prisma_1.prisma.supplier.findMany({
                orderBy: {
                    created_at: 'desc'
                }
            });
            res.status(200).json(suppliers);
        }
        catch (err) {
            console.log(err);
            res.status(500).json({ message: 'Server error' });
        }
    });
}
function updateSupplier(req, res) {
    return __awaiter(this, void 0, void 0, function* () { });
}
function deleteSupplier(req, res) {
    return __awaiter(this, void 0, void 0, function* () { });
}
