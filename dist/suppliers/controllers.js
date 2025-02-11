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
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            if (!id) {
                res.status(400).json({ message: "Invalid supplier id " });
                return;
            }
            const fetchSupplier = yield prisma_1.prisma.supplier.findFirst({
                where: {
                    id: parseInt(id)
                },
                select: {
                    supplier_type: true,
                    business_name: true,
                    first_name: true,
                    last_name: true,
                    phone: true,
                    email: true,
                    address: true,
                }
            });
            if (!fetchSupplier) {
                res.status(404).json({ message: "Supplier not found " });
                return;
            }
            const response = {
                supplierType: fetchSupplier.supplier_type,
                businessName: fetchSupplier.business_name,
                firstName: fetchSupplier.first_name,
                lastName: fetchSupplier.last_name,
                phone: fetchSupplier.phone,
                email: fetchSupplier.email,
                address: fetchSupplier.address,
            };
            res.status(200).json(response);
        }
        catch (err) {
            console.log(err);
            res.status(500).json({ message: 'Server error' });
        }
    });
}
function getSuppliers(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const fetchSuppliers = yield prisma_1.prisma.supplier.findMany({
                orderBy: {
                    created_at: 'desc'
                }
            });
            const suppliers = fetchSuppliers.map(supplier => ({
                id: supplier.id,
                supplierName: supplier.supplier_type === 'individual' ? `${supplier.first_name} ${supplier.last_name}` : `${supplier.business_name}`,
                email: supplier.email,
                phone: supplier.phone,
                address: supplier.address,
                createdAt: supplier.created_at
            }));
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
