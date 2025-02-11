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
    customerId: joi_1.default.number().messages({
        'number.base': 'Please select a customer',
        'any.required': 'Please select a customer'
    }),
    transactionDate: joi_1.default.date().default(new Date()),
    status: joi_1.default.string().required().messages({ 'any.required': 'Specify sales order status', 'string.empty': 'Specify sales order status' }),
    orderType: joi_1.default.string().required(),
    products: joi_1.default.array().required().min(1).items({
        productId: joi_1.default.string().required().messages({}),
        productSizes: joi_1.default.array().items({
            sizeId: joi_1.default.string().required(),
            colorId: joi_1.default.number().required().messages({ 'number.base': 'Please specify product color' }),
            quantity: joi_1.default.number().min(0).required().messages({ 'number.min': 'Quantity must be equal or greater than 0', 'any.required': 'Please specify the products quantity' }),
            cost: joi_1.default.number().min(0).precision(2).required().messages({ 'number.min': 'Cost price must be equal to or greater than 0', 'number.base': 'Please specify the cost price' })
        })
    }).messages({ 'array.min': 'Please select at least one product' })
});
function addSalesOrder(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { error, value } = addSalesOrderSchema.validate(req.body);
            if (error) {
                res.status(400).json({ message: error.details[0].message });
                return;
            }
            const { customerId, transactionDate, products, orderType } = value;
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
                        transaction_type: orderType,
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
                                data: Object.assign(Object.assign({ transaction_id: transaction.id, product_size_id: productSize.id, color_id: size.colorId, cost: size.cost }, (transaction.sale_status !== 'fulfilled' ?
                                    { pending_quantity: size.quantity,
                                    } :
                                    {
                                        remaining_quantity: size.quantity
                                    })), { quantity: size.quantity })
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
        var _a;
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
                    customer: {
                        select: {
                            id: true,
                        }
                    },
                    sale_status: true,
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
                                                                            },
                                                                        },
                                                                        select: {
                                                                            cost: true,
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
                customerId: (_a = getSale === null || getSale === void 0 ? void 0 : getSale.customer) === null || _a === void 0 ? void 0 : _a.id,
                status: getSale === null || getSale === void 0 ? void 0 : getSale.sale_status,
                orderDate: getSale === null || getSale === void 0 ? void 0 : getSale.transaction_date,
                products: getSale === null || getSale === void 0 ? void 0 : getSale.transaction_items.map(transactionItem => {
                    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
                    return ({
                        productId: (_b = (_a = transactionItem.product_size) === null || _a === void 0 ? void 0 : _a.products) === null || _b === void 0 ? void 0 : _b.id,
                        productName: (_d = (_c = transactionItem.product_size) === null || _c === void 0 ? void 0 : _c.products) === null || _d === void 0 ? void 0 : _d.name,
                        colorName: (_e = transactionItem.color) === null || _e === void 0 ? void 0 : _e.name,
                        colorId: (_f = transactionItem.color) === null || _f === void 0 ? void 0 : _f.id,
                        quantity: transactionItem.quantity,
                        cost: transactionItem.cost,
                        sizeId: (_h = (_g = transactionItem.product_size) === null || _g === void 0 ? void 0 : _g.sizes) === null || _h === void 0 ? void 0 : _h.id,
                        sizeName: (_k = (_j = transactionItem.product_size) === null || _j === void 0 ? void 0 : _j.sizes) === null || _k === void 0 ? void 0 : _k.name,
                        rawMaterials: (_m = (_l = transactionItem.product_size) === null || _l === void 0 ? void 0 : _l.products) === null || _m === void 0 ? void 0 : _m.bom.map(rawMaterial => rawMaterial.bom_list.map(bomListItem => ({
                            rawMaterialName: bomListItem.material.name,
                            rawMaterialId: bomListItem.material.id,
                            quantityPerUnit: bomListItem.quantity,
                            quantityNeeded: Number(bomListItem.quantity) * Number(transactionItem.quantity),
                            quantityAvailable: bomListItem.material.transactionItems.reduce((init, accum) => init + Number(accum.remaining_quantity), 0),
                            materialCost: bomListItem.material.transactionItems.reduce((init, accum) => init + Number(accum.cost) * Number(bomListItem.quantity), 0)
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
            const { orderStatus } = req.query;
            const orderStatusKey = orderStatus;
            const getSales = yield prisma_1.prisma.transaction.findMany({
                where: Object.assign(Object.assign({}, (orderStatus && {
                    sale_status: orderStatusKey
                })), { transaction_type: {
                        in: ['sale', 'manufacturing']
                    } }),
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
                    customerName: sales.transaction_type === 'manufacturing' ? 'In-house' : (((_a = sales.customer) === null || _a === void 0 ? void 0 : _a.customer_type) === 'individual' ? `${(_b = sales.customer) === null || _b === void 0 ? void 0 : _b.first_name} ${(_c = sales.customer) === null || _c === void 0 ? void 0 : _c.last_name}` : `${(_d = sales.customer) === null || _d === void 0 ? void 0 : _d.business_name}`),
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
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            if (isNaN(Number(id))) {
                res.status(400).json({ message: 'Invalid order ID' });
                return;
            }
            yield prisma_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                // Check if order exists and get its status
                const order = yield tx.transaction.findFirst({
                    where: {
                        id: Number(id),
                        transaction_type: {
                            in: ['sale', 'manufacturing']
                        }
                    },
                    include: {
                        transaction_items: true
                    }
                });
                if (!order) {
                    throw new Error('Order not found');
                }
                // Only allow deletion of pending orders
                if (order.sale_status !== 'pending') {
                    throw new Error('Only pending orders can be deleted');
                }
                // First delete transaction items
                yield tx.transactionItems.deleteMany({
                    where: {
                        transaction_id: Number(id)
                    }
                });
                // Then delete the main transaction
                yield tx.transaction.delete({
                    where: {
                        id: Number(id)
                    }
                });
            }));
            res.status(200).json({ message: 'Order deleted successfully' });
        }
        catch (err) {
            console.error('Error in deleteSalesOrders:', err);
            if (err instanceof Error) {
                res.status(400).json({ message: err.message });
                return;
            }
            res.status(500).json({ message: 'Server error occurred while deleting order' });
        }
    });
}
