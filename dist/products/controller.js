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
exports.addProduct = addProduct;
exports.getProducts = getProducts;
exports.getProduct = getProduct;
exports.updateProduct = updateProduct;
exports.deleteProduct = deleteProduct;
exports.fetchProductsForInvoicing = fetchProductsForInvoicing;
const joi_1 = __importDefault(require("joi"));
const prisma_1 = require("../lib/prisma");
// Validation schemas
const productSchema = joi_1.default.object({
    name: joi_1.default.string().required().messages({ 'any.required': 'Product name required', 'string.empty': 'Product name required' }),
    unitId: joi_1.default.number().optional().messages({ 'number.base': 'Please select unit' }),
    description: joi_1.default.string().allow(''),
    sizes: joi_1.default.array().items({
        sizeId: joi_1.default.number().required().messages({ 'number.required': "Please select at least one size" }),
        quantity: joi_1.default.number().min(0).messages({ 'number.min': 'Quantity must be equal or greater than 0', 'any.required': 'Quantity required', 'number.base': 'Invalid quantity' }),
        cost: joi_1.default.number().precision(2).min(0).messages({ 'number.min': 'Cost must be equal or greater than 0', 'number.precision': "Invalid cost price", 'any.required': "Cost price required", 'number.base': 'Invalid cost price' }),
    }).min(1).required().messages({ 'array.base': 'Please select at least one size', 'any.required': 'Please select at least one size', 'array.min': 'Please select at least one size' })
});
const updateProductSchema = joi_1.default.object({
    id: joi_1.default.string().required().messages({ 'number.base': 'Please select unit' }),
    name: joi_1.default.string().required().messages({ 'any.required': 'Product name required', 'string.empty': 'Product name required' }),
    unitId: joi_1.default.number().optional().messages({ 'number.base': 'Please select unit' }),
    description: joi_1.default.string().allow(''),
    sizes: joi_1.default.array().items({
        sizeId: joi_1.default.number().required().messages({ 'number.required': "Please select at least one size" }),
        quantity: joi_1.default.number().min(0).messages({ 'number.min': 'Quantity must be equal or greater than 0', 'any.required': 'Quantity required', 'number.base': 'Invalid quantity' }),
        cost: joi_1.default.number().precision(2).min(0).messages({ 'number.min': 'Cost must be equal or greater than 0', 'number.precision': "Invalid cost price", 'any.required': "Cost price required", 'number.base': 'Invalid cost price' }),
    }).min(1).required().messages({ 'array.base': 'Please select at least one size', 'any.required': 'Please select at least one size', 'array.min': 'Please select at least one size' })
});
function addProduct(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Validate request body
            const { error, value } = productSchema.validate(req.body);
            if (error) {
                res.status(400).json({ message: error.details[0].message });
                return;
            }
            const { name, unitId, description, sizes } = value;
            // Add products 
            const newProduct = yield prisma_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                const addProductTodb = yield tx.product.create({
                    data: {
                        name: name,
                        description: description,
                        unit_id: unitId,
                    }
                });
                //Create product sizes               
                const allSizes = sizes.map((size) => {
                    return {
                        product_id: addProductTodb.id,
                        size_id: size.sizeId,
                    };
                });
                yield tx.productSize.createMany({
                    data: allSizes,
                });
                //fetch the products sizes id 
                const productSizesId = yield tx.productSize.findMany({
                    where: {
                        product_id: addProductTodb.id
                    },
                    select: {
                        size_id: true,
                        id: true,
                    }
                });
                const addProductTransaction = yield tx.transaction.create({
                    data: {
                        transaction_type: 'opening_stock',
                        transaction_date: new Date(),
                    }
                });
                // Add opening stock transactions 
                const productSizeToId = allSizes.map((size) => {
                    const productSizeId = productSizesId.find((sizeId) => sizeId.size_id === size.size_id);
                    const productCostAndQuantities = sizes.find((product) => product.sizeId === size.size_id);
                    if (!productSizeId) {
                        throw new Error('Invalid product id');
                    }
                    return {
                        product_size_id: productSizeId.id,
                        cost: productCostAndQuantities.cost,
                        quantity: productCostAndQuantities.quantity,
                        transaction_id: addProductTransaction.id,
                        remaining_quantity: productCostAndQuantities.quantity,
                    };
                });
                yield tx.transactionItems.createMany({
                    data: productSizeToId
                });
            }));
            res.status(201).json({ message: "Product added successfully" });
        }
        catch (err) {
            console.log(err);
            res.status(500).json({ message: 'Server error' });
        }
    });
}
function getProducts(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const products = yield prisma_1.prisma.product.findMany({
                select: {
                    id: true,
                    name: true,
                    selling_price: true,
                    created_at: true,
                    product_sizes: {
                        select: {
                            sizes: {
                                select: {
                                    id: true,
                                    name: true,
                                }
                            },
                            transactions: {
                                select: {
                                    cost: true,
                                    remaining_quantity: true,
                                    transactions: {
                                        select: {
                                            transaction_type: true
                                        }
                                    }
                                }
                            }
                        }
                    },
                    unit: {
                        select: {
                            name: true
                        }
                    }
                }
            });
            const processedProducts = products.map(product => {
                var _a;
                const sizesSummary = product.product_sizes.map(productSizes => {
                    var _a, _b;
                    //
                    return ({
                        id: (_a = productSizes.sizes) === null || _a === void 0 ? void 0 : _a.id,
                        name: ((_b = productSizes.sizes) === null || _b === void 0 ? void 0 : _b.name) || 'Unknown',
                        currentStock: 0,
                        cost: 0,
                    });
                });
                return ({
                    id: product.id,
                    name: product.name,
                    unit: (_a = product.unit) === null || _a === void 0 ? void 0 : _a.name,
                    cost: product.product_sizes.map(productSize => productSize.transactions.filter(element => { var _a, _b; return ((_a = element.transactions) === null || _a === void 0 ? void 0 : _a.transaction_type) === 'manufacturing' || ((_b = element.transactions) === null || _b === void 0 ? void 0 : _b.transaction_type) === 'adjustment'; })).map(element => element.reduce((init, accum) => init + Number(accum.cost), 0)),
                    sellingPrice: product.selling_price,
                    data: product.product_sizes.map(productSize => {
                        var _a;
                        const remainingQuantity = productSize.transactions.filter(transaction => Number(transaction.remaining_quantity) > 0).reduce((init, accum) => init + Number(accum.remaining_quantity), 0);
                        return ({
                            size: (_a = productSize.sizes) === null || _a === void 0 ? void 0 : _a.name,
                            remainingQuantity,
                        });
                    }),
                    quantity: product.product_sizes.map(productSize => {
                        var _a;
                        const remainingQuantity = productSize.transactions.filter(transaction => Number(transaction.remaining_quantity) > 0).reduce((init, accum) => init + Number(accum.remaining_quantity), 0);
                        return ({
                            size: (_a = productSize.sizes) === null || _a === void 0 ? void 0 : _a.name,
                            remainingQuantity,
                        });
                    }).reduce((innit, accum) => innit + accum.remainingQuantity, 0),
                    sizes: sizesSummary,
                });
            });
            res.status(200).json(processedProducts);
        }
        catch (err) {
            console.error('Error in getProducts:', {
                error: err.message,
                stack: err.stack,
            });
            res.status(500).json({ message: 'An error occurred while fetching products' });
        }
    });
}
function getProduct(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        try {
            const { id } = req.params;
            // Validate ID is a number
            if (isNaN(Number(id))) {
                res.status(400).json({ message: 'Invalid ID format' });
                return;
            }
            const product = yield prisma_1.prisma.product.findUnique({
                where: {
                    id: Number(id)
                },
                select: {
                    id: true,
                    name: true,
                    description: true,
                    selling_price: true,
                    unit: {
                        select: {
                            name: true,
                            symbol: true,
                            id: true
                        }
                    },
                    product_sizes: {
                        select: {
                            id: true,
                            product_id: true,
                            sizes: true, // Changed from size to sizes based on schema
                            transactions: {
                                select: {
                                    color: {
                                        select: {
                                            name: true,
                                        }
                                    },
                                    cost: true,
                                    remaining_quantity: true,
                                    product_size_id: true,
                                    transactions: {
                                        select: {
                                            transaction_type: true,
                                            transaction_date: true
                                        }
                                    }
                                },
                                orderBy: {
                                    created_at: 'desc'
                                }
                            }
                        }
                    },
                    bom: {
                        select: {
                            bom_date: true,
                            quantity: true,
                            bom_list: {
                                select: {
                                    quantity: true,
                                    material: {
                                        select: {
                                            name: true,
                                            transactionItems: {
                                                select: {
                                                    quantity: true,
                                                    cost: true,
                                                    transactions: {
                                                        select: {
                                                            transaction_type: true,
                                                            transaction_date: true
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    },
                                }
                            }
                        }
                    }
                }
            });
            if (!product) {
                res.status(404).json({ message: 'Product not found' });
                return;
            }
            // Process product sizes and their transactions
            const processedSizes = product.product_sizes.map(productSize => {
                var _a, _b, _c;
                let totalOpeningStock = 0;
                let totalPurchases = 0;
                let totalSales = 0;
                let totalAdjustments = 0;
                let latestCostPrice = 0;
                // Find the latest transaction with a cost
                const latestTransaction = productSize.transactions
                    .sort((a, b) => {
                    var _a, _b;
                    return new Date(((_a = b.transactions) === null || _a === void 0 ? void 0 : _a.transaction_date) || 0).getTime() -
                        new Date(((_b = a.transactions) === null || _b === void 0 ? void 0 : _b.transaction_date) || 0).getTime();
                })
                    .find(t => t.cost !== null);
                latestCostPrice = Number(latestTransaction === null || latestTransaction === void 0 ? void 0 : latestTransaction.cost) || 0;
                //Calculating quantity for this size 
                const quantity = (_a = product
                    .product_sizes.filter(size => size.product_id === product.id)
                    .map(transItem => transItem.transactions)
                    .find(tran => {
                    const quantityOfThisProduct = tran.filter(t => t.product_size_id === productSize.id);
                    return quantityOfThisProduct.length;
                })) === null || _a === void 0 ? void 0 : _a.reduce((init, sum) => init + Number(sum.remaining_quantity), 0);
                return {
                    sizeName: (_b = productSize.sizes) === null || _b === void 0 ? void 0 : _b.name,
                    sizeId: (_c = productSize.sizes) === null || _c === void 0 ? void 0 : _c.id,
                    quantity,
                    cost: latestCostPrice,
                    transaction_summary: {
                        total_opening_stock: totalOpeningStock,
                        total_purchases: totalPurchases,
                        total_sales: totalSales,
                        total_adjustments: totalAdjustments
                    }
                };
            });
            const processedProduct = {
                id: product.id,
                name: product.name,
                description: product.description,
                selling_price: product.selling_price,
                unitId: (_a = product.unit) === null || _a === void 0 ? void 0 : _a.id,
                unitName: (_b = product.unit) === null || _b === void 0 ? void 0 : _b.name,
                unitSymbol: (_c = product.unit) === null || _c === void 0 ? void 0 : _c.symbol,
                sizes: processedSizes,
                bill_of_materials: product.bom.map(bom => ({
                    date: bom.bom_date,
                    quantity: bom.quantity,
                    materials: bom.bom_list.map(item => ({
                        material: item.material.name,
                        quantityNeeded: item.quantity,
                        quantityAvailable: (item.material.transactionItems.map(transactionItem => transactionItem.quantity)).reduce((prev, accum) => prev + Number(accum), 0)
                    }))
                })),
            };
            res.status(200).json(processedProduct);
        }
        catch (err) {
            console.error('Error in getProduct:', err);
            res.status(500).json({ message: 'Server error' });
        }
    });
}
function updateProduct(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            // Validate ID is a number
            if (isNaN(Number(id))) {
                res.status(400).json({ message: 'Invalid ID format' });
                return;
            }
            // Validate request body
            const { error, value } = updateProductSchema.validate(req.body);
            if (error) {
                res.status(400).json({ message: error.details[0].message });
                return;
            }
            const { name, unitId, sku, description, selling_price, sizes } = value;
            // Update product using transaction
            const updatedProduct = yield prisma_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                // Check if product exists
                const existingProduct = yield tx.product.findUnique({
                    where: { id: Number(id) },
                    include: { product_sizes: true }
                });
                if (!existingProduct) {
                    throw new Error('Product not found');
                }
                // Update basic product info
                const updatedProductInfo = yield tx.product.update({
                    where: { id: Number(id) },
                    data: {
                        name,
                        description,
                        unit_id: unitId,
                        selling_price
                    }
                });
                // Delete existing product sizes
                yield tx.productSize.deleteMany({
                    where: { product_id: Number(id) }
                });
                // Create new product sizes
                const newSizes = sizes.map((size) => ({
                    product_id: Number(id),
                    size_id: size.sizeId
                }));
                const createdSizes = yield tx.productSize.createMany({
                    data: newSizes
                });
                // Create adjustment transaction
                const transaction = yield tx.transaction.create({
                    data: {
                        transaction_type: 'adjustment',
                        transaction_date: new Date()
                    }
                });
                // Get newly created product sizes
                const productSizes = yield tx.productSize.findMany({
                    where: { product_id: Number(id) }
                });
                // Create transaction items for each size
                const transactionItems = sizes.map((size) => {
                    const productSize = productSizes.find(ps => ps.size_id === size.sizeId);
                    if (!productSize) {
                        throw new Error('Invalid product size');
                    }
                    return {
                        product_size_id: productSize.id,
                        transaction_id: transaction.id,
                        quantity: size.quantity,
                        remaining_quantity: size.quantity,
                        cost: size.cost
                    };
                });
                yield tx.transactionItems.createMany({
                    data: transactionItems
                });
                return updatedProductInfo;
            }));
            res.status(200).json({
                message: 'Product updated successfully',
                product: updatedProduct
            });
        }
        catch (err) {
            console.error('Error in updateProduct:', err);
            if (err.message === 'Product not found') {
                res.status(404).json({ message: 'Product not found' });
            }
            else {
                res.status(500).json({ message: 'Server error' });
            }
        }
    });
}
function deleteProduct(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            // Validate ID is a number
            if (isNaN(Number(id))) {
                res.status(400).json({ message: 'Invalid ID format' });
                return;
            }
            yield prisma_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                // Check if product exists
                const existingProduct = yield tx.product.findUnique({
                    where: { id: Number(id) },
                    include: {
                        product_sizes: true,
                        bom: {
                            include: {
                                bom_list: true
                            }
                        }
                    }
                });
                if (!existingProduct) {
                    throw new Error('Product not found');
                }
                // Delete related transaction items
                for (const productSize of existingProduct.product_sizes) {
                    yield tx.transactionItems.deleteMany({
                        where: { product_size_id: productSize.id }
                    });
                }
                // Delete BOM lists first
                for (const bom of existingProduct.bom) {
                    yield tx.billOfMaterialsList.deleteMany({
                        where: { bom_id: bom.id }
                    });
                }
                // Delete BOMs
                yield tx.billOfMaterials.deleteMany({
                    where: { product_id: Number(id) }
                });
                // Delete product sizes
                yield tx.productSize.deleteMany({
                    where: { product_id: Number(id) }
                });
                // Finally delete the product
                yield tx.product.delete({
                    where: { id: Number(id) }
                });
            }));
            res.status(204).send();
        }
        catch (err) {
            console.error('Error in deleteProduct:', err);
            if (err.message === 'Product not found') {
                res.status(404).json({ message: 'Product not found' });
            }
            else {
                res.status(500).json({ message: 'Server error' });
            }
        }
    });
}
function fetchProductsForInvoicing(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const products = yield prisma_1.prisma.product.findMany({
                select: {
                    id: true,
                    name: true,
                    selling_price: true,
                    product_sizes: {
                        select: {
                            sizes: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            },
                            transactions: {
                                where: {
                                    remaining_quantity: {
                                        gt: 0
                                    }
                                },
                                select: {
                                    remaining_quantity: true,
                                    cost: true,
                                    color: {
                                        select: {
                                            id: true,
                                            name: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });
            const processedProducts = products.map(product => {
                const rawSizes = product.product_sizes.flatMap(size => size.transactions
                    .filter(trans => trans.color && Number(trans.remaining_quantity) > 0)
                    .map(trans => {
                    var _a, _b, _c, _d;
                    return ({
                        sizeId: (_a = size.sizes) === null || _a === void 0 ? void 0 : _a.id,
                        sizeName: (_b = size.sizes) === null || _b === void 0 ? void 0 : _b.name,
                        colorId: (_c = trans.color) === null || _c === void 0 ? void 0 : _c.id,
                        color: (_d = trans.color) === null || _d === void 0 ? void 0 : _d.name,
                        quantity: Number(trans.remaining_quantity),
                        cost: Number(trans.cost)
                    });
                }));
                // Combine duplicates
                const combinedSizes = rawSizes.reduce((acc, curr) => {
                    const existing = acc.find(item => item.sizeId === curr.sizeId &&
                        item.colorId === curr.colorId);
                    if (existing) {
                        existing.quantity += curr.quantity;
                        if (curr.cost > 0) {
                            existing.cost = curr.cost;
                        }
                    }
                    else {
                        acc.push(Object.assign({}, curr));
                    }
                    return acc;
                }, []);
                return {
                    name: product.name,
                    id: product.id,
                    sellingPrice: Number(product.selling_price),
                    sizes: combinedSizes
                };
            }).filter(product => product.sizes.length > 0);
            res.status(200).json(processedProducts);
        }
        catch (err) {
            console.error('Error in fetchProductsForInvoicing:', err);
            res.status(500).json({ message: 'Server error occurred while fetching products' });
        }
    });
}
