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
exports.addProduction = addProduction;
exports.getProductions = getProductions;
exports.getProduction = getProduction;
exports.updateProduction = updateProduction;
exports.deleteProduction = deleteProduction;
const prisma_1 = require("../lib/prisma");
const joi_1 = __importDefault(require("joi"));
const addProductSchema = joi_1.default.object({
    productionDate: joi_1.default.date().default(new Date()).required(),
    status: joi_1.default.string().required,
    products: joi_1.default.array().items({
        productId: joi_1.default.number(),
        sizeId: joi_1.default.number(),
        colorId: joi_1.default.number(),
        quantity: joi_1.default.number(),
    }),
    rawMaterials: joi_1.default.array().items({
        materialId: joi_1.default.number(),
        quantity: joi_1.default.number(),
    }),
    productionCosts: joi_1.default.array()
});
function addProduction(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            //Validate fields 
            const { error, value } = addProductSchema.validate(addProductSchema);
            if (error) {
                res.status(400).json(error.details[0].message);
                return;
            }
            const { products, rawMaterials, status, productionDate } = value;
            //Add prisma transaction 
            const addProductionTxn = yield prisma_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                const processProductSizes = products.map(product => product.productId);
                //Fetch product size ids
                const fetchProductSizeIds = yield prisma_1.prisma.productSize.findMany({
                    where: {
                        size_id: {
                            in: processProductSizes
                        }
                    }
                });
                const addTransaction = yield tx.transaction.create({
                    data: {
                        transaction_date: productionDate,
                        transaction_type: 'production'
                    }
                });
                //Add product sizes to an array 
                const productToAddToSizeItems = [];
                for (const product of products) {
                    for (const productSizeId of fetchProductSizeIds) {
                        if (product.sizeId === productSizeId.size_id && product.productId === productSizeId.product_id) {
                            const productToAdd = {
                                color_id: product.colorId,
                                product_size_id: productSizeId.id,
                                cost: 0,
                                transaction_id: addTransaction.id,
                                remaining_quantity: product.quantity,
                                quantity: product.quantity
                            };
                            productToAddToSizeItems.push(productToAdd);
                        }
                    }
                }
                //Add products to transaction items 
                const appProducts = yield tx.transactionItems.createMany({
                    data: productToAddToSizeItems
                });
            }));
            res.status(500).json({ message: 'Successful' });
        }
        catch (err) {
            res.status(500).json({ message: 'Server error ' });
        }
    });
}
function getProductions() {
    return __awaiter(this, void 0, void 0, function* () { });
}
function getProduction() {
    return __awaiter(this, void 0, void 0, function* () { });
}
function updateProduction() {
    return __awaiter(this, void 0, void 0, function* () { });
}
function deleteProduction() {
    return __awaiter(this, void 0, void 0, function* () { });
}
