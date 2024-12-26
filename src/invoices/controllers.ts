import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import Joi from 'joi';

const invoiceItemSchema = Joi.object({
    productId: Joi.number().required(),
    productName: Joi.string().required(),
    sizeId: Joi.number().required(),
    sizeName: Joi.string().required(),
    colorId: Joi.number().required(),
    color: Joi.string().required(),
    quantity: Joi.number().min(1).required(),
    availableQuantity: Joi.number().min(0).required(),
    sellingPrice: Joi.number().min(0).required()
});

const invoiceSchema = Joi.object({
    customerId: Joi.number().required(),
    date: Joi.date().required(),
    items: Joi.array().items(invoiceItemSchema).min(1).required(),
    paymentMethod: Joi.string().valid('Cash', 'Card', 'Bank Transfer').required()
});

export async function addInvoice(req: Request, res: Response) {
    try {
        // Validate request body
        const { error, value } = invoiceSchema.validate(req.body);
        if (error) {
            res.status(400).json({ message: error.details[0].message });
            return 
        }

        const { customerId, date, items, paymentMethod } = value;

        // Start transaction
        const result = await prisma.$transaction(async (tx) => {
            // Create sale transaction
            const saleTransaction = await tx.transaction.create({
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
                const productSize = await tx.productSize.findFirst({
                    where: {
                        product_id: item.productId,
                        size_id: item.sizeId
                    }
                });

                if (!productSize) {
                    throw new Error(`Product size not found for product ${item.productName} size ${item.sizeName}`);
                }

                // Find available stock with the specified colorId
                const availableStock = await tx.transactionItems.findMany({
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
                    if (remainingQuantityToProcess <= 0) break;

                    const quantityToReduce = Math.min(
                        Number(stock.remaining_quantity), 
                        remainingQuantityToProcess
                    );

                    // Update remaining quantity
                    await tx.transactionItems.update({
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
                await tx.transactionItems.create({
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
        });

        res.status(201).json({
            message: 'Invoice created successfully',
            invoiceId: result.id
        });

    } catch (err) {
        console.error('Error in addInvoice:', err);
        res.status(400).json({ 
            message: err instanceof Error ? err.message : 'Failed to create invoice' 
        });
    }
}

export async function getInvoices(req: Request, res: Response) {
    try {
        const invoices = await prisma.transaction.findMany({
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

        const processedInvoices = invoices.map(invoice => ({
            id: invoice.id,
            date: invoice.transaction_date,
            paymentMethod: invoice.payment_method,
            customer: invoice.customer?.business_name || 
                     `${invoice.customer?.first_name} ${invoice.customer?.last_name}`.trim(),
            totalAmount: invoice.transaction_items.reduce((sum, item) => 
                sum + (Number(item.quantity) * Number(item.cost)), 0),
            itemCount: invoice.transaction_items.length
        }));

        res.status(200).json(processedInvoices);
    } catch (err) {
        console.error('Error in getInvoices:', err);
        res.status(500).json({ message: 'Failed to fetch invoices' });
    }
}

export async function getInvoice(req: Request, res: Response) {
    try {
        const { id } = req.params;
        
        if (isNaN(Number(id))) {
            res.status(400).json({ message: 'Invalid invoice ID' });
            return 
        }

        const invoice = await prisma.transaction.findFirst({
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
            return 
        }

        const processedInvoice = {
            id: invoice.id,
            date: invoice.transaction_date,
            paymentMethod: invoice.payment_method,
            customer: {
                id: invoice.customer?.id,
                name: invoice.customer?.business_name || 
                      `${invoice.customer?.first_name} ${invoice.customer?.last_name}`.trim(),
                email: invoice.customer?.email,
                phone: invoice.customer?.phone,
                address: invoice.customer?.address
            },
            items: invoice.transaction_items.map(item => ({
                id: item.id,
                productName: item.product_size?.products?.name,
                size: item.product_size?.sizes?.name,
                color: item.color?.name,
                quantity: Number(item.quantity),
                unitPrice: Number(item.cost),
                totalPrice: Number(item.quantity) * Number(item.cost),
                unit: item.product_size?.products?.unit?.symbol
            })),
            totalAmount: invoice.transaction_items.reduce((sum, item) => 
                sum + (Number(item.quantity) * Number(item.cost)), 0)
        };

        res.status(200).json(processedInvoice);
    } catch (err) {
        console.error('Error in getInvoice:', err);
        res.status(500).json({ message: 'Failed to fetch invoice details' });
    }
}

export async function deleteInvoice(req: Request, res: Response) {
    try {
        const { id } = req.params;

        if (isNaN(Number(id))) {
            res.status(400).json({ message: 'Invalid invoice ID' });
            return 
        }

        await prisma.$transaction(async (tx) => {
            // First verify the invoice exists and is a sale
            const invoice = await tx.transaction.findFirst({
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
                    await tx.transactionItems.create({
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
            await tx.transactionItems.deleteMany({
                where: {
                    transaction_id: Number(id)
                }
            });

            // Delete the transaction
            await tx.transaction.delete({
                where: {
                    id: Number(id)
                }
            });
        });

        res.status(200).json({ message: 'Invoice deleted successfully' });
    } catch (err) {
        console.error('Error in deleteInvoice:', err);
        res.status(400).json({ 
            message: err instanceof Error ? err.message : 'Failed to delete invoice' 
        });
    }
}