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
const joi_1 = __importDefault(require("joi"));
const prisma_1 = require("../lib/prisma");
// Validation schemas
const productSchema = joi_1.default.object({
    name: joi_1.default.string().required(),
    unitId: joi_1.default.number().optional(),
    sku: joi_1.default.string().optional().allow(''),
    description: joi_1.default.string().allow(''),
    sizes: joi_1.default.array().items({
        sizeId: joi_1.default.number(),
        quantity: joi_1.default.number().min(1),
        cost: joi_1.default.number().min(0),
    })
});
const updateProductSchema = joi_1.default.object({
    name: joi_1.default.string().optional(),
    unitId: joi_1.default.number().optional(),
    sku: joi_1.default.string().optional().allow(''),
    description: joi_1.default.string().allow(''),
    sellingPrice: joi_1.default.number().min(0).optional(),
    openingStockDate: joi_1.default.date().default(new Date()),
    openingStock: joi_1.default.number().min(0).default(0),
    costPrice: joi_1.default.number().min(0).default(0),
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
            const { name, unitId, sku, description, sizes } = value;
            // Add products 
            const newProduct = yield prisma_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                const addProductTodb = yield tx.product.create({
                    data: {
                        name: name,
                        description: description,
                        unit_id: unitId,
                        sku: sku
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
                const addTransactionItems = yield tx.transactionItems.createMany({
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
                orderBy: { created_at: 'desc' },
                include: {
                    unit: {
                        select: {
                            name: true,
                            symbol: true,
                        },
                    },
                    bom: {
                        select: {
                            bom_list: {
                                select: {
                                    quantity: true,
                                    material: {
                                        select: {
                                            id: true,
                                            name: true,
                                            transactionItems: {
                                                select: {
                                                    cost: true,
                                                    quantity: true,
                                                    transactions: {
                                                        select: {
                                                            transaction_date: true,
                                                            transaction_type: true
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    product_sizes: {
                        include: {
                            sizes: {
                                select: {
                                    id: true,
                                    name: true,
                                }
                            },
                            transactions: {
                                include: {
                                    transactions: {
                                        select: {
                                            transaction_type: true,
                                            transaction_date: true,
                                            created_at: true,
                                        },
                                    },
                                },
                                orderBy: { created_at: 'desc' },
                            },
                        },
                    },
                },
            });
            const processedProducts = products.map((product) => {
                var _a;
                const sizesSummary = product.product_sizes.map((productSize) => {
                    var _a, _b;
                    let totalOpeningStock = 0;
                    let totalPurchases = 0;
                    let totalSales = 0;
                    let totalAdjustments = 0;
                    let latestCostPrice = 0;
                    productSize.transactions.forEach((transaction) => {
                        var _a;
                        const quantity = transaction.quantity || 0;
                        const cost = transaction.cost || 0;
                        switch ((_a = transaction.transactions) === null || _a === void 0 ? void 0 : _a.transaction_type) {
                            case 'opening_stock':
                                totalOpeningStock += quantity;
                                if (cost)
                                    latestCostPrice = cost;
                                break;
                            case 'purchase':
                                totalPurchases += quantity;
                                if (cost)
                                    latestCostPrice = cost;
                                break;
                            case 'sale':
                                totalSales += quantity;
                                break;
                            case 'adjustment':
                                totalAdjustments += quantity;
                                break;
                        }
                    });
                    const currentStock = totalOpeningStock + totalPurchases - totalSales + totalAdjustments;
                    return {
                        id: (_a = productSize.sizes) === null || _a === void 0 ? void 0 : _a.id,
                        name: ((_b = productSize.sizes) === null || _b === void 0 ? void 0 : _b.name) || 'Unknown',
                        currentStock,
                        cost: latestCostPrice
                        // transaction_summary: {
                        //     total_opening_stock: totalOpeningStock,
                        //     total_purchases: totalPurchases,
                        //     total_sales: totalSales,
                        //     total_adjustments: totalAdjustments,
                        // },
                    };
                });
                const totalStock = sizesSummary.reduce((sum, size) => sum + size.currentStock, 0);
                const averageCost = sizesSummary.reduce((sum, size) => sum + size.cost, 0) / (sizesSummary.length || 1);
                const bom = product.bom.map(prodItem => prodItem.bom_list.map((bomListItem => ({
                    id: bomListItem.material.id,
                    name: bomListItem.material.name,
                    quantityNeeded: bomListItem.quantity,
                    quantityAvailable: bomListItem.material.transactionItems.map(bomListItem => bomListItem.quantity).reduce((initial, accum) => (initial + accum), 0)
                })))).flat(2);
                return {
                    id: product.id,
                    name: product.name,
                    sku: product.sku,
                    description: product.description,
                    selling_price: product.selling_price,
                    unit: ((_a = product.unit) === null || _a === void 0 ? void 0 : _a.symbol) || 'N/A',
                    bom: bom,
                    // total_stock: totalStock,
                    // average_cost: Math.round(averageCost),
                    sizes: sizesSummary,
                    created_at: product.created_at,
                    updated_at: product.updated_at,
                };
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
                include: {
                    unit: {
                        select: {
                            name: true,
                            symbol: true
                        }
                    },
                    product_sizes: {
                        include: {
                            sizes: true, // Changed from size to sizes based on schema
                            transactions: {
                                include: {
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
                        include: {
                            bom_list: {
                                include: {
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
                var _a;
                let totalOpeningStock = 0;
                let totalPurchases = 0;
                let totalSales = 0;
                let totalAdjustments = 0;
                let latestCostPrice = 0;
                // Calculate totals for each transaction type
                productSize.transactions.forEach((item) => {
                    const quantity = item.quantity || 0;
                    switch (item.transactions.transaction_type) {
                        case 'opening_stock':
                            totalOpeningStock += quantity;
                            if (item.cost)
                                latestCostPrice = item.cost;
                            break;
                        case 'purchase':
                            totalPurchases += quantity;
                            if (item.cost)
                                latestCostPrice = item.cost;
                            break;
                        case 'sale':
                            totalSales += quantity;
                            break;
                        case 'adjustment':
                            totalAdjustments += quantity;
                            break;
                    }
                });
                const currentStock = totalOpeningStock + totalPurchases - totalSales + totalAdjustments;
                return {
                    size: (_a = productSize.sizes) === null || _a === void 0 ? void 0 : _a.name,
                    currentStock,
                    latestCostPrice,
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
                sku: product.sku,
                description: product.description,
                selling_price: product.selling_price,
                unit: product.unit,
                sizes: processedSizes,
                bill_of_materials: product.bom.map(bom => ({
                    date: bom.bom_date,
                    quantity: bom.quantity,
                    materials: bom.bom_list.map(item => ({
                        material: item.material.name,
                        quantityNeeded: item.quantity,
                        quantityAvailable: (item.material.transactionItems.map(transactionItem => transactionItem.quantity)).reduce((prev, accum) => prev + accum, 0)
                    }))
                })),
                created_at: product.created_at,
                updated_at: product.updated_at
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
            const { error, value } = productSchema.validate(req.body);
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
                        sku,
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