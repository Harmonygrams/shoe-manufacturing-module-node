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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addPurchase = addPurchase;
exports.getPurchases = getPurchases;
const prisma_1 = require("../lib/prisma");
const joi_1 = __importDefault(require("joi"));
const schema_1 = require("../configs/schema");
const addPurchaseSchema = joi_1.default.object({
    supplierId: schema_1.validateSchema.idField('Supplier'),
    purchaseDate: schema_1.validateSchema.dateField('Purchase date'),
    rawMaterials: schema_1.validateSchema.arrayField('Raw materials').items({
        materialId: schema_1.validateSchema.idField('Raw Material'),
        name: joi_1.default.string(),
        quantity: schema_1.validateSchema.quantity(),
        cost: schema_1.validateSchema.cost()
    }).min(1).required().messages({ 'array.min': 'Please select at least one raw material', 'any.required': 'Please select at least one raw material' })
});
function addPurchase(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { error, value } = addPurchaseSchema.validate(req.body);
            if (error) {
                res.status(400).json({ message: error.details[0].message });
                return;
            }
            const { rawMaterials, supplierId, purchaseDate } = value;
            //add a prisma transaction 
            const addPrismaTransaction = yield prisma_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                //Add a purchase transaction
                const addTransaction = yield tx.transaction.create({
                    data: {
                        supplier_id: supplierId,
                        transaction_date: purchaseDate,
                        transaction_type: 'purchase',
                    }
                });
                //Process transaction item data 
                const rawMaterialsToAdd = rawMaterials.map(rawMaterial => ({
                    material_id: rawMaterial.materialId,
                    cost: rawMaterial.cost,
                    transaction_id: addTransaction.id,
                    quantity: rawMaterial.quantity,
                    remaining_quantity: rawMaterial.quantity
                }));
                //Add transaction items 
                const addTransactionItmes = yield tx.transactionItems.createMany({
                    data: rawMaterialsToAdd
                });
            }));
            res.status(201).json({ message: 'success' });
        }
        catch (err) {
            console.log(err);
            res.status(500).json({ message: 'Server error' });
        }
    });
}
function getPurchases(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { cursor } = req.query;
            const fetchPurchases = yield prisma_1.prisma.transaction.findMany(Object.assign(Object.assign({ where: {
                    transaction_type: 'purchase',
                } }, (cursor && {
                cursor: {
                    id: Number(cursor),
                },
                skip: 1,
            })), { take: 10, select: {
                    id: true,
                    created_at: true,
                    transaction_date: true,
                    supplier: {
                        select: {
                            id: true,
                            first_name: true,
                            last_name: true,
                            business_name: true,
                            supplier_type: true,
                        }
                    },
                    transaction_items: true,
                }, orderBy: {
                    created_at: 'desc'
                } }));
            const purchases = fetchPurchases.map(purchase => {
                var _a, _b;
                return ({
                    id: purchase.id,
                    supplier: {
                        id: purchase.supplier ? purchase.supplier.id : null,
                        name: purchase.supplier ? (purchase.supplier.supplier_type === 'business' ? purchase.supplier.business_name : `${(_a = purchase.supplier) === null || _a === void 0 ? void 0 : _a.first_name} ${(_b = purchase.supplier) === null || _b === void 0 ? void 0 : _b.last_name}`) : null
                    },
                    date: purchase.transaction_date,
                    materialCount: purchase.transaction_items.length,
                    totalCost: purchase.transaction_items.reduce((init, sum) => init + Number(sum.cost), 0)
                });
            });
            const page = {
                data: purchases,
                nextCursor: purchases[purchases.length - 1].id,
            };
            res.status(200).json(page);
        }
        catch (err) {
            console.log(err);
            res.status(500).json({ message: 'Server error occurred' });
        }
    });
}
