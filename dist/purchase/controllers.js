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
const prisma_1 = require("../lib/prisma");
const joi_1 = __importDefault(require("joi"));
const addPurchaseSchema = joi_1.default.object({
    supplierId: joi_1.default.number(),
    purchaseDate: joi_1.default.date().default(new Date()),
    rawMaterials: joi_1.default.array().items({
        materialId: joi_1.default.number(),
        quantity: joi_1.default.number().min(1),
        cost: joi_1.default.number()
    })
});
function addPurchase(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { error, value } = addPurchaseSchema.validate(req.body);
            if (error) {
                res.status(400).json(error.details[0].message);
            }
            const { rawMaterials, supplierId, purchaseDate } = value;
            //add a prisma transaction 
            const addPrismaTransaction = yield prisma_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                //Add a purchase transaction
                const addTransaction = yield tx.transaction.create({
                    data: {
                        transaction_date: purchaseDate,
                        transaction_type: 'purchase'
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
            res.status(500).json({ message: 'Server error' });
        }
    });
}
