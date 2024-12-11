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
exports.addSalesOrder = addSalesOrder;
exports.getSalesOrder = getSalesOrder;
exports.getSalesOrders = getSalesOrders;
exports.updateSalesOrders = updateSalesOrders;
exports.deleteSalesOrders = deleteSalesOrders;
const joi_1 = __importDefault(require("joi"));
const prisma_1 = require("../lib/prisma");
const addSalesOrderSchema = joi_1.default.object({
    customerId: joi_1.default.number().required(),
    transactionDate: joi_1.default.date().default(new Date()),
    status: joi_1.default.string(),
    products: joi_1.default.array().items({
        productId: joi_1.default.string().required(),
        productSizes: joi_1.default.array().items({
            sizeId: joi_1.default.string().required(),
            colorId: joi_1.default.number(),
            quantity: joi_1.default.number().min(1).required(),
            cost: joi_1.default.number().min(0).required()
        })
    })
});
function addSalesOrder(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { error, value } = addSalesOrderSchema.validate(req.body);
            if (error) {
                res.status(400).json({ message: error.details[0].message });
                return;
            }
            const { customerId, transactionDate, products } = value;
            const prismaTransaction = yield prisma_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                // Get all product IDs for validation
                const getProductIds = products.map(product => parseInt(product.productId));
                // Verify all product sizes exist
                const productSizesInDb = yield tx.productSize.findMany({
                    where: {
                        product_id: {
                            in: getProductIds
                        }
                    },
                    include: {
                        products: true,
                        sizes: true
                    }
                });
                // Validate that all requested products and sizes exist
                for (const product of products) {
                    for (const size of product.productSizes) {
                        const validProductSize = productSizesInDb.find(ps => ps.product_id === parseInt(product.productId) &&
                            ps.size_id === parseInt(size.sizeId));
                        if (!validProductSize) {
                            throw new Error(`Invalid product size combination: Product ${product.productId} with size ${size.sizeId}`);
                        }
                    }
                }
                // Create the transaction record
                const transaction = yield tx.transaction.create({
                    data: {
                        transaction_type: 'sale',
                        sale_status: 'pending',
                        customer_id: customerId,
                        transaction_date: transactionDate,
                    }
                });
                // Create transaction items for each product size
                const transactionItems = [];
                for (const product of products) {
                    for (const size of product.productSizes) {
                        const productSize = productSizesInDb.find(ps => ps.product_id === parseInt(product.productId) &&
                            ps.size_id === parseInt(size.sizeId));
                        if (productSize) {
                            const transactionItem = yield tx.transactionItems.create({
                                data: {
                                    transaction_id: transaction.id,
                                    product_size_id: productSize.id,
                                    color_id: size.colorId,
                                    quantity: size.quantity,
                                    cost: size.cost,
                                    remaining_quantity: size.quantity
                                }
                            });
                            transactionItems.push(transactionItem);
                        }
                    }
                }
                return {
                    transaction,
                    transactionItems
                };
            }));
            res.status(201).json({
                message: 'Sales order created successfully',
                data: prismaTransaction
            });
        }
        catch (err) {
            console.error('Sales order error:', err);
            if (err instanceof Error && err.message.includes('Invalid product size')) {
                res.status(400).json({ message: err.message });
                return;
            }
            res.status(500).json({ message: 'Server error occurred' });
        }
    });
}
function getSalesOrder(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            const getSale = yield prisma_1.prisma.transaction.findFirst({
                where: {
                    id: Number(id)
                },
                orderBy: {
                    transaction_date: 'desc'
                },
                select: {
                    id: true,
                    transaction_date: true,
                    transaction_items: {
                        select: {
                            cost: true,
                            raw_material: {
                                select: {
                                    name: true,
                                }
                            },
                            product_size: {
                                select: {
                                    sizes: {
                                        select: {
                                            id: true,
                                            name: true
                                        }
                                    },
                                    products: {
                                        select: {
                                            id: true,
                                            name: true,
                                            bom: {
                                                select: {
                                                    bom_list: {
                                                        select: {
                                                            quantity: true, //Quantity needed to make this product 
                                                            material: {
                                                                select: {
                                                                    id: true,
                                                                    name: true, //Name of the raw material
                                                                    transactionItems: {
                                                                        where: {
                                                                            remaining_quantity: {
                                                                                gt: 0
                                                                            },
                                                                            transactions: {
                                                                                transaction_type: {
                                                                                    in: ['adjustment', 'opening_stock', 'purchase']
                                                                                }
                                                                            }
                                                                        },
                                                                        select: {
                                                                            remaining_quantity: true, //Quantity remaining in the system
                                                                            transactions: {
                                                                                select: {
                                                                                    transaction_date: true,
                                                                                    transaction_type: true,
                                                                                }
                                                                            }
                                                                        }
                                                                    }
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
                            color: {
                                select: {
                                    name: true,
                                    id: true
                                }
                            },
                            quantity: true,
                        }
                    }
                }
            });
            const saleOrder = {
                id: getSale === null || getSale === void 0 ? void 0 : getSale.id,
                orderDate: getSale === null || getSale === void 0 ? void 0 : getSale.transaction_date,
                products: getSale === null || getSale === void 0 ? void 0 : getSale.transaction_items.map(transactionItem => {
                    var _a, _b, _c, _d, _e, _f, _g;
                    return ({
                        productId: (_b = (_a = transactionItem.product_size) === null || _a === void 0 ? void 0 : _a.products) === null || _b === void 0 ? void 0 : _b.id,
                        productName: (_d = (_c = transactionItem.product_size) === null || _c === void 0 ? void 0 : _c.products) === null || _d === void 0 ? void 0 : _d.name,
                        colorName: (_e = transactionItem.color) === null || _e === void 0 ? void 0 : _e.name,
                        quantity: transactionItem.quantity,
                        cost: transactionItem.cost,
                        rawMaterials: (_g = (_f = transactionItem.product_size) === null || _f === void 0 ? void 0 : _f.products) === null || _g === void 0 ? void 0 : _g.bom.map(rawMaterial => rawMaterial.bom_list.map(bomListItem => ({
                            rawMaterialName: bomListItem.material.name,
                            rawMaterialId: bomListItem.material.id,
                            quantityNeeded: bomListItem.quantity * transactionItem.quantity,
                            quantityAvailable: bomListItem.material.transactionItems.reduce((init, accum) => init + accum.remaining_quantity, 0)
                        }))).flat(1)
                    });
                })
            };
            res.status(200).json(saleOrder);
        }
        catch (err) {
            res.status(500).json({ 'message': 'Server error ' });
        }
    });
}
function getSalesOrders(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const getSales = yield prisma_1.prisma.transaction.findMany({
                where: {
                    transaction_type: 'sale',
                },
                orderBy: {
                    transaction_date: 'desc'
                },
                select: {
                    id: true,
                    transaction_date: true,
                    transaction_type: true,
                    sale_status: true,
                    customer: {
                        select: {
                            first_name: true,
                            business_name: true,
                            last_name: true,
                            customer_type: true,
                        }
                    },
                    transaction_items: {
                        select: {
                            quantity: true,
                            color: {
                                select: {
                                    name: true,
                                    id: true
                                }
                            },
                            product_size: {
                                select: {
                                    products: {
                                        select: {
                                            name: true,
                                            id: true
                                        }
                                    },
                                }
                            },
                        }
                    }
                }
            });
            const salesOrder = getSales.map(sales => {
                var _a, _b, _c, _d;
                return ({
                    id: sales.id,
                    customerName: ((_a = sales.customer) === null || _a === void 0 ? void 0 : _a.customer_type) === 'individual' ? `${(_b = sales.customer) === null || _b === void 0 ? void 0 : _b.first_name} ${(_c = sales.customer) === null || _c === void 0 ? void 0 : _c.last_name}` : `${(_d = sales.customer) === null || _d === void 0 ? void 0 : _d.business_name}`,
                    orderDate: sales.transaction_date,
                    status: sales.sale_status,
                    products: sales.transaction_items.map(sale => {
                        var _a, _b, _c, _d, _e, _f;
                        return ({
                            productId: (_b = (_a = sale.product_size) === null || _a === void 0 ? void 0 : _a.products) === null || _b === void 0 ? void 0 : _b.id,
                            productName: (_d = (_c = sale.product_size) === null || _c === void 0 ? void 0 : _c.products) === null || _d === void 0 ? void 0 : _d.name,
                            quantity: sale.quantity,
                            colorId: (_e = sale.color) === null || _e === void 0 ? void 0 : _e.id,
                            colorName: (_f = sale.color) === null || _f === void 0 ? void 0 : _f.name,
                        });
                    })
                });
            });
            res.status(200).json(salesOrder);
        }
        catch (err) {
            res.status(500).json({ 'message': 'Server error ' });
        }
    });
}
function updateSalesOrders(req, res) {
    return __awaiter(this, void 0, void 0, function* () { });
}
function deleteSalesOrders(req, res) {
    return __awaiter(this, void 0, void 0, function* () { });
}
