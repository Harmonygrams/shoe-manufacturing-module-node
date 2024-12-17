import { Request, Response } from "express";
import Joi from "joi";
import { prisma } from "../lib/prisma";

// Validation schemas
const productSchema = Joi.object({
    name: Joi.string().required().messages({'any.required' : 'Product name required', 'string.empty' : 'Product name required'}),
    unitId: Joi.number().optional().messages({'number.base' : 'Please select unit'}),
    description : Joi.string().allow(''),
    sizes : Joi.array().items({
        sizeId : Joi.number().required().messages({ 'number.required' : "Please select at least one size" }),
        quantity : Joi.number().min(0).messages({ 'number.min' : 'Quantity must be equal or greater than 0', 'any.required' : 'Quantity required', 'number.base' : 'Invalid quantity'}), 
        cost : Joi.number().precision(2).min(0).messages({ 'number.min' : 'Cost must be equal or greater than 0', 'number.precision' : "Invalid cost price", 'any.required' : "Cost price required", 'number.base' : 'Invalid cost price'}),
    }).min(1).required().messages({'array.base' : 'Please select at least one size', 'any.required' : 'Please select at least one size', 'array.min' : 'Please select at least one size'})
});

const updateProductSchema = Joi.object({
    name: Joi.string().optional(),
    unitId: Joi.number().optional(),
    sku : Joi.string().optional().allow(''),
    description : Joi.string().allow(''),
    sellingPrice: Joi.number().min(0).optional(),
    openingStockDate : Joi.date().default(new Date()), 
    openingStock : Joi.number().min(0).default(0),
    costPrice: Joi.number().min(0).default(0),
});

export async function addProduct(req: Request, res: Response) {
    try {
        // Validate request body
        const { error, value } = productSchema.validate(req.body);
        if (error) {
            res.status(400).json({ message: error.details[0].message });
            return 
        }
        const { name, unitId, sku, description, sizes} = value;
        // Add products 
        const newProduct = await prisma.$transaction(async (tx) => {
            const addProductTodb = await tx.product.create({
                data : {
                    name : name, 
                    description : description, 
                    unit_id : unitId,  
                }
            })
            //Create product sizes               
            const allSizes = sizes.map((size :any)=> {
                return {
                    product_id : addProductTodb.id,
                    size_id : size.sizeId, 
                }
            })
            await tx.productSize.createMany({
                data : allSizes,
            })
            //fetch the products sizes id 
            const productSizesId = await tx.productSize.findMany({
                where : {
                    product_id : addProductTodb.id
                }, 
                select : {
                    size_id : true, 
                    id : true,
                }
            })
            const addProductTransaction = await tx.transaction.create({
                data : {
                    transaction_type : 'opening_stock',
                    transaction_date : new Date(),
                }
            })
            // Add opening stock transactions 
            const productSizeToId = allSizes.map((size : any) => {
                const productSizeId = productSizesId.find((sizeId : any) => sizeId.size_id === size.size_id)
                const productCostAndQuantities = sizes.find((product : any) => product.sizeId === size.size_id)
                if(!productSizeId){
                    throw new Error('Invalid product id')
                }
                return {
                    product_size_id : productSizeId.id,
                    cost : productCostAndQuantities.cost, 
                    quantity : productCostAndQuantities.quantity, 
                    transaction_id : addProductTransaction.id, 
                    remaining_quantity : productCostAndQuantities.quantity,
                }
            })
            const addTransactionItems = await tx.transactionItems.createMany({
                data : productSizeToId
            })

        })
        res.status(201).json({ message : "Product added successfully"});
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: 'Server error' });
    }
}

export async function getProducts(req: Request, res: Response) {
    try {
        const products = await prisma.product.findMany({
            orderBy: { created_at: 'desc' },
            include: {
                unit: {
                    select: {
                        name: true,
                        symbol: true,
                    },
                },
                bom : {
                    select : {
                        bom_list : {
                            select : {
                                quantity : true,
                                material : {
                                    select : { 
                                        id : true,
                                        name : true, 
                                        transactionItems : {
                                        select : {
                                            cost : true, 
                                            quantity : true, 
                                            transactions : {
                                                select : {
                                                    transaction_date : true, 
                                                    transaction_type : true
                                                }
                                            }
                                        }
                                    }}
                                }
                            }
                        }
                    }
                }, 
                product_sizes: {
                    include: {
                        sizes: {
                            select : {
                                id : true,
                                name : true, 
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

            const sizesSummary = product.product_sizes.map((productSize) => {
                let totalOpeningStock = 0;
                let totalPurchases = 0;
                let totalSales = 0;
                let totalAdjustments = 0;
                let latestCostPrice = 0;

                productSize.transactions.forEach((transaction) => {
                    const quantity = transaction.quantity || 0;
                    const cost = transaction.cost || 0;

                    switch (transaction.transactions?.transaction_type) {
                        case 'opening_stock':
                            totalOpeningStock += Number(quantity);
                            if (cost) latestCostPrice = Number(cost);
                            break;
                        case 'purchase':
                            totalPurchases += Number(quantity);
                            if (cost) latestCostPrice = Number(cost);
                            break;
                        case 'sale':
                            totalSales += Number(quantity);
                            break;
                        case 'adjustment':
                            totalAdjustments += Number(quantity);
                            break;
                    }
                });

                const currentStock =
                    totalOpeningStock + totalPurchases - totalSales + totalAdjustments;

                return {
                    id : productSize.sizes?.id,
                    name: productSize.sizes?.name || 'Unknown',
                    currentStock,
                    cost : latestCostPrice
                    // transaction_summary: {
                    //     total_opening_stock: totalOpeningStock,
                    //     total_purchases: totalPurchases,
                    //     total_sales: totalSales,
                    //     total_adjustments: totalAdjustments,
                    // },
                };
            });

            const totalStock = sizesSummary.reduce(
                (sum, size) => sum + size.currentStock,
                0
            );
            const averageCost =
                sizesSummary.reduce(
                    (sum, size) => sum + size.cost,
                    0
                ) / (sizesSummary.length || 1);
            
            const bom = product.bom.map(prodItem => 
                prodItem.bom_list.map((bomListItem => ({
                    id : bomListItem.material.id,
                    name : bomListItem.material.name, 
                    quantityNeeded : bomListItem.quantity, 
                    quantityAvailable : bomListItem.material.transactionItems.map(bomListItem => bomListItem.quantity).reduce((initial, accum) => (initial + Number(accum)), 0)
                })))).flat(2);
            return {
                id: product.id,
                name: product.name,
                description: product.description,
                selling_price: product.selling_price,
                unit: product.unit?.symbol || 'N/A',
                bom : bom,
                // total_stock: totalStock,
                // average_cost: Math.round(averageCost),
                sizes: sizesSummary,
                created_at: product.created_at,
                updated_at: product.updated_at,
            };
        });

        res.status(200).json(processedProducts);
    } catch (err : any) {
        console.error('Error in getProducts:', {
            error: err.message,
            stack: err.stack,
        });
        res.status(500).json({ message: 'An error occurred while fetching products' });
    }
}

export async function getProduct(req: Request, res: Response) {
    try {
        const { id } = req.params;

        // Validate ID is a number
        if (isNaN(Number(id))) {
            res.status(400).json({ message: 'Invalid ID format' });
            return;
        }

        const product = await prisma.product.findUnique({
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
                                    select : {
                                        name : true, 
                                        transactionItems : {
                                            select : {
                                                quantity : true, 
                                                cost : true,
                                                transactions : {
                                                    select : {
                                                        transaction_type : true, 
                                                        transaction_date : true
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
            let totalOpeningStock = 0;
            let totalPurchases = 0;
            let totalSales = 0;
            let totalAdjustments = 0;
            let latestCostPrice = 0;

            // Calculate totals for each transaction type
            productSize.transactions.forEach((item : any) => {
                const quantity = item.quantity || 0;
                
                switch (item.transactions.transaction_type) {
                    case 'opening_stock':
                        totalOpeningStock += quantity;
                        if (item.cost) latestCostPrice = item.cost;
                        break;
                    case 'purchase':
                        totalPurchases += quantity;
                        if (item.cost) latestCostPrice = item.cost;
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
                size: productSize.sizes?.name,
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
                    quantityAvailable : (item.material.transactionItems.map(transactionItem => transactionItem.quantity)).reduce((prev, accum) => prev + Number(accum), 0)
                }))
            })),
            created_at: product.created_at,
            updated_at: product.updated_at
        };

        res.status(200).json(processedProduct);
    } catch (err) {
        console.error('Error in getProduct:', err);
        res.status(500).json({ message: 'Server error' });
    }
}

export async function updateProduct(req: Request, res: Response) {
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
        const updatedProduct = await prisma.$transaction(async (tx) => {
            // Check if product exists
            const existingProduct = await tx.product.findUnique({
                where: { id: Number(id) },
                include: { product_sizes: true }
            });

            if (!existingProduct) {
                throw new Error('Product not found');
            }

            // Update basic product info
            const updatedProductInfo = await tx.product.update({
                where: { id: Number(id) },
                data: {
                    name,
                    description,
                    unit_id: unitId,
                    selling_price
                }
            });

            // Delete existing product sizes
            await tx.productSize.deleteMany({
                where: { product_id: Number(id) }
            });

            // Create new product sizes
            const newSizes = sizes.map((size: any) => ({
                product_id: Number(id),
                size_id: size.sizeId
            }));

            const createdSizes = await tx.productSize.createMany({
                data: newSizes
            });

            // Create adjustment transaction
            const transaction = await tx.transaction.create({
                data: {
                    transaction_type: 'adjustment',
                    transaction_date: new Date()
                }
            });

            // Get newly created product sizes
            const productSizes = await tx.productSize.findMany({
                where: { product_id: Number(id) }
            });

            // Create transaction items for each size
            const transactionItems = sizes.map((size: any) => {
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

            await tx.transactionItems.createMany({
                data: transactionItems
            });

            return updatedProductInfo;
        });

        res.status(200).json({ 
            message: 'Product updated successfully',
            product: updatedProduct 
        });
    } catch (err : any) {
        console.error('Error in updateProduct:', err);
        if (err.message === 'Product not found') {
            res.status(404).json({ message: 'Product not found' });
        } else {
            res.status(500).json({ message: 'Server error' });
        }
    }
}

export async function deleteProduct(req: Request, res: Response) {
    try {
        const { id } = req.params;

        // Validate ID is a number
        if (isNaN(Number(id))) {
            res.status(400).json({ message: 'Invalid ID format' });
            return;
        }

        await prisma.$transaction(async (tx) => {
            // Check if product exists
            const existingProduct = await tx.product.findUnique({
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
                await tx.transactionItems.deleteMany({
                    where: { product_size_id: productSize.id }
                });
            }

            // Delete BOM lists first
            for (const bom of existingProduct.bom) {
                await tx.billOfMaterialsList.deleteMany({
                    where: { bom_id: bom.id }
                });
            }

            // Delete BOMs
            await tx.billOfMaterials.deleteMany({
                where: { product_id: Number(id) }
            });

            // Delete product sizes
            await tx.productSize.deleteMany({
                where: { product_id: Number(id) }
            });

            // Finally delete the product
            await tx.product.delete({
                where: { id: Number(id) }
            });
        });

        res.status(204).send();
    } catch (err : any) {
        console.error('Error in deleteProduct:', err);
        if (err.message === 'Product not found') {
            res.status(404).json({ message: 'Product not found' });
        } else {
            res.status(500).json({ message: 'Server error' });
        }
    }
}