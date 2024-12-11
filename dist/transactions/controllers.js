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
exports.addOpeningStock = addOpeningStock;
exports.addAdjustment = addAdjustment;
exports.addPurchase = addPurchase;
exports.addSale = addSale;
const prisma_1 = require("../lib/prisma");
const joi_1 = __importDefault(require("joi"));
const addOpeningStockTransactionSchema = joi_1.default.object({
    materialId: joi_1.default.string().allow(''),
    transactionDate: joi_1.default.date().default(new Date()),
    transactionItems: joi_1.default.array().items({
        transactionId: joi_1.default.string(),
        materialId: joi_1.default.string(),
        productId: joi_1.default.string(),
        quantity: joi_1.default.number().min(1).required(),
        cost: joi_1.default.number().min(0).required(),
        productSizeId: joi_1.default.number(),
    })
});
function addOpeningStock(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { transactionType, transactionDate, transactionItems } = req.body;
            if (transactionType === "opening_stock") {
                const addOpeningStockTransaction = prisma_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                    const updateOpeningStock = yield tx.transaction.create({
                        data: {
                            transaction_type: 'opening_stock',
                            transaction_date: transactionDate
                        }
                    });
                    //All transactions 
                    const openingStockItems = transactionItems.map((transactionItem) => {
                        return {
                            transaction_id: transactionItem.transactionId,
                            quantity: transactionItem.quantity,
                            const: transactionItem.cost,
                            material_id: transactionItem.materialId,
                            product_size_id: transactionItem.productSizeId,
                        };
                    });
                    yield tx.transactionItems.createMany({
                        data: openingStockItems
                    });
                }));
                res.status(201).json({ message: 'Opening stock updated ' });
                return;
            }
            res.status(400).json({ message: 'Please specify transaction type' });
        }
        catch (err) {
            console.log(err);
            res.status(500).json({ message: "Server error occurred" });
        }
    });
}
function addAdjustment() {
    return __awaiter(this, void 0, void 0, function* () { });
}
function addPurchase(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        // try {
        //     const { transactionType, quantity, cost, materialId, productId, transactionDate,  } = req.body;
        //     if(transactionType === "purchase"){
        //         const newPurchase = await prisma.transaction.create({
        //             data : {
        //                 transaction_type : 'purchase',
        //                 transaction_date : transactionDate,
        //                 quantity, 
        //                 cost, 
        //                 material_id : materialId, 
        //                 product_id : productId,
        //             }
        //         })
        //         res.status(201).json({ message : 'Purchase added successfully'})
        //         return 
        //     }
        //     res.status(400).json({ message : 'Please specify transaction type'})
        // }catch(err){
        //     console.log(err)
        //     res.status(500).json({ message : 'Server error occurred'})
        // }
    });
}
function addSale() {
    return __awaiter(this, void 0, void 0, function* () { });
}
