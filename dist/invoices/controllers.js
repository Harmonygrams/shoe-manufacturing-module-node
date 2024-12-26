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
exports.addInvoice = addInvoice;
exports.getInvoices = getInvoices;
exports.getInvoice = getInvoice;
exports.deleteInvoice = deleteInvoice;
const prisma_1 = require("../lib/prisma");
const joi_1 = __importDefault(require("joi"));
const invoiceItemSchema = joi_1.default.object({
    productId: joi_1.default.number().required(),
    productName: joi_1.default.string().required(),
    sizeId: joi_1.default.number().required(),
    sizeName: joi_1.default.string().required(),
    colorId: joi_1.default.number().required(),
    color: joi_1.default.string().required(),
    quantity: joi_1.default.number().min(1).required(),
    availableQuantity: joi_1.default.number().min(0).required(),
    sellingPrice: joi_1.default.number().min(0).required()
});
const invoiceSchema = joi_1.default.object({
    customerId: joi_1.default.number().required(),
    date: joi_1.default.date().required(),
    items: joi_1.default.array().items(invoiceItemSchema).min(1).required(),
    paymentMethod: joi_1.default.string().valid('Cash', 'Card', 'Bank Transfer').required()
});
function addInvoice(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Validate request body
            const { error, value } = invoiceSchema.validate(req.body);
            if (error) {
                res.status(400).json({ message: error.details[0].message });
                return;
            }
            const { customerId, date, items, paymentMethod } = value;
            // Start transaction
            const result = yield prisma_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                // Create sale transaction
                const saleTransaction = yield tx.transaction.create({
                    data: {
                        transaction_type: 'sale',
                        customer_id: customerId,
                        transaction_date: new Date(date),
                        payment_method: paymentMethod,
                        sale_status: 'fulfilled'
                    }
                });
                // Process each item
                for (const item of items) {
                    // Get product size ID
                    const productSize = yield tx.productSize.findFirst({
                        where: {
                            product_id: item.productId,
                            size_id: item.sizeId
                        }
                    });
                    if (!productSize) {
                        throw new Error(`Product size not found for product ${item.productName} size ${item.sizeName}`);
                    }
                    // Find available stock with the specified colorId
                    const availableStock = yield tx.transactionItems.findMany({
                        where: {
                            product_size_id: productSize.id,
                            color_id: item.colorId,
                            remaining_quantity: {
                                gt: 0
                            }
                        },
                        orderBy: {
                            created_at: 'asc' // Use FIFO method
                        }
                    });
                    let remainingQuantityToProcess = item.quantity;
                    // Process stock reduction
                    for (const stock of availableStock) {
                        if (remainingQuantityToProcess <= 0)
                            break;
                        const quantityToReduce = Math.min(Number(stock.remaining_quantity), remainingQuantityToProcess);
                        // Update remaining quantity
                        yield tx.transactionItems.update({
                            where: { id: stock.id },
                            data: {
                                remaining_quantity: Number(stock.remaining_quantity) - quantityToReduce
                            }
                        });
                        remainingQuantityToProcess -= quantityToReduce;
                    }
                    if (remainingQuantityToProcess > 0) {
                        throw new Error(`Insufficient stock for ${item.productName} size ${item.sizeName} ${item.color}`);
                    }
                    // Create sale transaction item
                    yield tx.transactionItems.create({
                        data: {
                            transaction_id: saleTransaction.id,
                            product_size_id: productSize.id,
                            quantity: item.quantity,
                            cost: item.sellingPrice,
                            color_id: item.colorId
                        }
                    });
                }
                return saleTransaction;
            }));
            res.status(201).json({
                message: 'Invoice created successfully',
                invoiceId: result.id
            });
        }
        catch (err) {
            console.error('Error in addInvoice:', err);
            res.status(400).json({
                message: err instanceof Error ? err.message : 'Failed to create invoice'
            });
        }
    });
}
function getInvoices(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const invoices = yield prisma_1.prisma.transaction.findMany({
                where: {
                    transaction_type: 'sale'
                },
                select: {
                    id: true,
                    transaction_date: true,
                    payment_method: true,
                    customer: {
                        select: {
                            first_name: true,
                            last_name: true,
                            business_name: true
                        }
                    },
                    transaction_items: {
                        select: {
                            quantity: true,
                            cost: true,
                            product_size: {
                                select: {
                                    products: {
                                        select: {
                                            name: true
                                        }
                                    },
                                    sizes: {
                                        select: {
                                            name: true
                                        }
                                    }
                                }
                            },
                            color: {
                                select: {
                                    name: true
                                }
                            }
                        }
                    }
                },
                orderBy: {
                    created_at: 'desc'
                }
            });
            const processedInvoices = invoices.map(invoice => {
                var _a, _b, _c;
                return ({
                    id: invoice.id,
                    date: invoice.transaction_date,
                    paymentMethod: invoice.payment_method,
                    customer: ((_a = invoice.customer) === null || _a === void 0 ? void 0 : _a.business_name) ||
                        `${(_b = invoice.customer) === null || _b === void 0 ? void 0 : _b.first_name} ${(_c = invoice.customer) === null || _c === void 0 ? void 0 : _c.last_name}`.trim(),
                    totalAmount: invoice.transaction_items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.cost)), 0),
                    itemCount: invoice.transaction_items.length
                });
            });
            res.status(200).json(processedInvoices);
        }
        catch (err) {
            console.error('Error in getInvoices:', err);
            res.status(500).json({ message: 'Failed to fetch invoices' });
        }
    });
}
function getInvoice(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g;
        try {
            const { id } = req.params;
            if (isNaN(Number(id))) {
                res.status(400).json({ message: 'Invalid invoice ID' });
                return;
            }
            const invoice = yield prisma_1.prisma.transaction.findFirst({
                where: {
                    id: Number(id),
                    transaction_type: 'sale'
                },
                select: {
                    id: true,
                    transaction_date: true,
                    payment_method: true,
                    customer: {
                        select: {
                            id: true,
                            first_name: true,
                            last_name: true,
                            business_name: true,
                            email: true,
                            phone: true,
                            address: true
                        }
                    },
                    transaction_items: {
                        select: {
                            id: true,
                            quantity: true,
                            cost: true,
                            product_size: {
                                select: {
                                    products: {
                                        select: {
                                            id: true,
                                            name: true,
                                            unit: {
                                                select: {
                                                    symbol: true
                                                }
                                            }
                                        }
                                    },
                                    sizes: {
                                        select: {
                                            id: true,
                                            name: true
                                        }
                                    }
                                }
                            },
                            color: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            }
                        }
                    }
                }
            });
            if (!invoice) {
                res.status(404).json({ message: 'Invoice not found' });
                return;
            }
            const processedInvoice = {
                id: invoice.id,
                date: invoice.transaction_date,
                paymentMethod: invoice.payment_method,
                customer: {
                    id: (_a = invoice.customer) === null || _a === void 0 ? void 0 : _a.id,
                    name: ((_b = invoice.customer) === null || _b === void 0 ? void 0 : _b.business_name) ||
                        `${(_c = invoice.customer) === null || _c === void 0 ? void 0 : _c.first_name} ${(_d = invoice.customer) === null || _d === void 0 ? void 0 : _d.last_name}`.trim(),
                    email: (_e = invoice.customer) === null || _e === void 0 ? void 0 : _e.email,
                    phone: (_f = invoice.customer) === null || _f === void 0 ? void 0 : _f.phone,
                    address: (_g = invoice.customer) === null || _g === void 0 ? void 0 : _g.address
                },
                items: invoice.transaction_items.map(item => {
                    var _a, _b, _c, _d, _e, _f, _g, _h;
                    return ({
                        id: item.id,
                        productName: (_b = (_a = item.product_size) === null || _a === void 0 ? void 0 : _a.products) === null || _b === void 0 ? void 0 : _b.name,
                        size: (_d = (_c = item.product_size) === null || _c === void 0 ? void 0 : _c.sizes) === null || _d === void 0 ? void 0 : _d.name,
                        color: (_e = item.color) === null || _e === void 0 ? void 0 : _e.name,
                        quantity: Number(item.quantity),
                        unitPrice: Number(item.cost),
                        totalPrice: Number(item.quantity) * Number(item.cost),
                        unit: (_h = (_g = (_f = item.product_size) === null || _f === void 0 ? void 0 : _f.products) === null || _g === void 0 ? void 0 : _g.unit) === null || _h === void 0 ? void 0 : _h.symbol
                    });
                }),
                totalAmount: invoice.transaction_items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.cost)), 0)
            };
            res.status(200).json(processedInvoice);
        }
        catch (err) {
            console.error('Error in getInvoice:', err);
            res.status(500).json({ message: 'Failed to fetch invoice details' });
        }
    });
}
function deleteInvoice(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = req.params;
            if (isNaN(Number(id))) {
                res.status(400).json({ message: 'Invalid invoice ID' });
                return;
            }
            yield prisma_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                // First verify the invoice exists and is a sale
                const invoice = yield tx.transaction.findFirst({
                    where: {
                        id: Number(id),
                        transaction_type: 'sale'
                    },
                    include: {
                        transaction_items: true
                    }
                });
                if (!invoice) {
                    throw new Error('Invoice not found');
                }
                // Restore the stock quantities
                for (const item of invoice.transaction_items) {
                    if (item.product_size_id) {
                        // Create a new transaction item to restore the stock
                        yield tx.transactionItems.create({
                            data: {
                                transaction_id: invoice.id,
                                product_size_id: item.product_size_id,
                                color_id: item.color_id,
                                quantity: item.quantity,
                                remaining_quantity: item.quantity,
                                cost: item.cost
                            }
                        });
                    }
                }
                // Delete the original transaction items
                yield tx.transactionItems.deleteMany({
                    where: {
                        transaction_id: Number(id)
                    }
                });
                // Delete the transaction
                yield tx.transaction.delete({
                    where: {
                        id: Number(id)
                    }
                });
            }));
            res.status(200).json({ message: 'Invoice deleted successfully' });
        }
        catch (err) {
            console.error('Error in deleteInvoice:', err);
            res.status(400).json({
                message: err instanceof Error ? err.message : 'Failed to delete invoice'
            });
        }
    });
}
