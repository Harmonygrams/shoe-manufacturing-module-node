import { Request, Response } from "express";
import Joi from "joi";
import { prisma } from "../lib/prisma";

const addSalesOrderSchema = Joi.object({
    customerId : Joi.number().messages({
        'number.base' : 'Please select a customer', 
        'any.required' : 'Please select a customer'
    }),
    transactionDate : Joi.date().default(new Date()), 
    status : Joi.string().required().messages({'any.required' : 'Specify sales order status', 'string.empty' : 'Specify sales order status'}),
    orderType : Joi.string().required(),
    products : Joi.array().required().min(1).items({
        productId : Joi.string().required().messages({}), 
        productSizes : Joi.array().items({
            sizeId : Joi.string().required(), 
            colorId : Joi.number().required().messages({'number.base' : 'Please specify product color'}),
            quantity : Joi.number().min(0).required().messages({'number.min' : 'Quantity must be equal or greater than 0', 'any.required' : 'Please specify the products quantity'}), 
            cost : Joi.number().min(0).precision(2).required().messages({'number.min' : 'Cost price must be equal to or greater than 0', 'number.base' : 'Please specify the cost price'})
        })
    }).messages({'array.min' : 'Please select at least one product'})
})
type ProductSize = { 
    sizeId : string; 
    colorId : number; 
    quantity : number; 
    cost : number; 
}
type Product = { 
    productId : string, 
    productSizes : ProductSize[]
}
type Order = { 
    customerId: number, 
    transactionDate: Date, 
    orderType : 'sale' | 'manufacturing',
    products: Product[] 
}
type OrderStatus = 'pending' | 'processing' | 'fulfilled'

export async function addSalesOrder(req: Request, res: Response) {
    try {
        const { error, value } = addSalesOrderSchema.validate(req.body);
        if (error) {
            res.status(400).json({ message: error.details[0].message });
            return 
        }
        const { customerId, transactionDate, products, orderType }: Order = value;
        const prismaTransaction = await prisma.$transaction(async (tx) => {
            // Get all product IDs for validation
            const getProductIds = products.map(product => parseInt(product.productId));
            // Verify all product sizes exist
            const productSizesInDb = await tx.productSize.findMany({
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
                    const validProductSize = productSizesInDb.find(ps => 
                        ps.product_id === parseInt(product.productId) && 
                        ps.size_id === parseInt(size.sizeId)
                    );
                    if (!validProductSize) {
                        throw new Error(`Invalid product size combination: Product ${product.productId} with size ${size.sizeId}`);
                    }
                }
            }

            // Create the transaction record
            const transaction = await tx.transaction.create({
                data: {
                    transaction_type: orderType,
                    sale_status : 'pending',
                    customer_id: customerId,
                    transaction_date: transactionDate,
                }
            });
            // Create transaction items for each product size
            const transactionItems = [];
            for (const product of products) {
                for (const size of product.productSizes) {
                    const productSize = productSizesInDb.find(ps => 
                        ps.product_id === parseInt(product.productId) && 
                        ps.size_id === parseInt(size.sizeId)
                    );

                    if (productSize) {
                        const transactionItem = await tx.transactionItems.create({
                            data: {
                                transaction_id: transaction.id,
                                product_size_id: productSize.id,
                                color_id: size.colorId,
                                cost: size.cost, 
                                ...(transaction.sale_status !== 'fulfilled' ?
                                    {   pending_quantity: size.quantity,
                                    } : 
                                    {
                                        remaining_quantity : size.quantity
                                    }
                                ),
                                quantity : size.quantity,
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
        });

        res.status(201).json({
            message: 'Sales order created successfully',
            data: prismaTransaction
        });

    } catch (err) {
        console.error('Sales order error:', err);
        if (err instanceof Error && err.message.includes('Invalid product size')) {
            res.status(400).json({ message: err.message });
            return 
        }
        res.status(500).json({ message: 'Server error occurred' });
    }
}
export async function getSalesOrder (req : Request, res: Response) {
    try{
        const { id } = req.params; 
        const getSale = await prisma.transaction.findFirst({
            where : {
                id : Number(id)
            },
            orderBy : {
                transaction_date : 'desc'
            }, 
            select : {
                id : true,
                transaction_date : true, 
                customer : {
                    select : {
                        id : true,
                    }
                },
                sale_status : true,
                transaction_items : {
                    select : {
                        cost : true, 
                        raw_material : {
                            select : {
                                name : true, 
                            }
                        }, 
                        product_size : {
                            select : {
                                sizes : {
                                    select : {
                                        id : true,
                                        name : true
                                    }
                                },
                                products : {
                                    select : {
                                        id : true,
                                        name : true,
                                        bom : {
                                            select : {
                                                bom_list : {
                                                    select : {
                                                        quantity : true, //Quantity needed to make this product 
                                                        material : {
                                                            select : {
                                                                id : true,
                                                                name : true,  //Name of the raw material
                                                                transactionItems : {
                                                                    where : {
                                                                        remaining_quantity : {
                                                                            gt : 0
                                                                        },
                                                                        transactions : {
                                                                            transaction_type : { 
                                                                                in : ['adjustment', 'opening_stock', 'purchase']
                                                                            }
                                                                        }, 
                                                                    },
                                                                    select : {
                                                                        cost : true,
                                                                        remaining_quantity : true, //Quantity remaining in the system
                                                                        transactions : {
                                                                            select : {
                                                                                transaction_date : true, 
                                                                                transaction_type : true,
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
                        color : {
                            select : {
                                name : true, 
                                id : true 
                            }
                        }, 
                        quantity : true,
                    }
                }
            }
        })
    const saleOrder = {
        id: getSale?.id,
        customerId : getSale?.customer?.id,
        status : getSale?.sale_status,
        orderDate: getSale?.transaction_date, 
        products : getSale?.transaction_items.map(transactionItem => ({
                productId : transactionItem.product_size?.products?.id,
                productName : transactionItem.product_size?.products?.name, 
                colorName : transactionItem.color?.name, 
                colorId : transactionItem.color?.id, 
                quantity : transactionItem.quantity, 
                cost : transactionItem.cost, 
                sizeId : transactionItem.product_size?.sizes?.id, 
                sizeName : transactionItem.product_size?.sizes?.name,
                rawMaterials : transactionItem.product_size?.products?.bom.map(rawMaterial => rawMaterial.bom_list.map(bomListItem => ({ 
                    rawMaterialName : bomListItem.material.name, 
                    rawMaterialId : bomListItem.material.id, 
                    quantityPerUnit : bomListItem.quantity,
                    quantityNeeded : Number(bomListItem.quantity) * Number(transactionItem.quantity),
                    quantityAvailable : bomListItem.material.transactionItems.reduce((init, accum) => init + Number(accum.remaining_quantity), 0),
                    materialCost : bomListItem.material.transactionItems.reduce((init, accum )=> init + Number(accum.cost) * Number(bomListItem.quantity), 0)
                }))).flat(1)
        }))
    }
    res.status(200).json(saleOrder);
    }catch(err){
        res.status(500).json({ 'message' : 'Server error '})
    }

}
export async function getSalesOrders (req : Request, res: Response) {
    try { 
        const { orderStatus }  = req.query;
        const orderStatusKey = orderStatus as OrderStatus;
        const getSales = await prisma.transaction.findMany({
            where : {
                ...(orderStatus && {
                    sale_status : orderStatusKey
                }),
                transaction_type : {
                    in : ['sale', 'manufacturing']
                },
            },
            orderBy : {
                transaction_date : 'desc'
            }, 
            select : {
                id : true,
                transaction_date : true, 
                transaction_type : true,
                sale_status : true,
                customer : {
                    select : {
                        first_name : true,
                        business_name : true,
                        last_name : true, 
                        customer_type : true, 
                    }
                }, 
                transaction_items : {
                    select : {
                        quantity : true,
                        color : {
                            select : {
                                name : true,
                                id : true
                            }
                        },
                        product_size : {
                            select : {
                                products : {
                                    select : {
                                        name : true,
                                        id : true
                                    }
                                },
                            }
                        },
                    }
                }
            }
        })
        const salesOrder = getSales.map(sales => ({
            id : sales.id,
            customerName : sales.transaction_type === 'manufacturing' ? 'In-house' : (sales.customer?.customer_type === 'individual' ?  `${sales.customer?.first_name} ${sales.customer?.last_name}` : `${sales.customer?.business_name}`),
            orderDate : sales.transaction_date,
            status : sales.sale_status,
            products : sales.transaction_items.map(sale => ({
                productId : sale.product_size?.products?.id,
                productName : sale.product_size?.products?.name,
                quantity : sale.quantity,
                colorId : sale.color?.id,
                colorName : sale.color?.name, 
            }))
        }))
        res.status(200).json(salesOrder);
    }catch(err){
        res.status(500).json({ 'message' : 'Server error '})
    }
}
export async function updateSalesOrders (req : Request, res: Response) {}

export async function deleteSalesOrders(req: Request, res: Response) {
    try {
        const { id } = req.params;

        if (isNaN(Number(id))) {
            res.status(400).json({ message: 'Invalid order ID' });
            return 
        }

        await prisma.$transaction(async (tx) => {
            // Check if order exists and get its status
            const order = await tx.transaction.findFirst({
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
            await tx.transactionItems.deleteMany({
                where: {
                    transaction_id: Number(id)
                }
            });

            // Then delete the main transaction
            await tx.transaction.delete({
                where: {
                    id: Number(id)
                }
            });
        });

        res.status(200).json({ message: 'Order deleted successfully' });
    } catch (err) {
        console.error('Error in deleteSalesOrders:', err);
        if (err instanceof Error) {
            res.status(400).json({ message: err.message });
            return 
        }
        res.status(500).json({ message: 'Server error occurred while deleting order' });
    }
}