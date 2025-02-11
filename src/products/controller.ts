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
    id : Joi.string().required().messages({'number.base' : 'Please select unit'}),
    name: Joi.string().required().messages({'any.required' : 'Product name required', 'string.empty' : 'Product name required'}),
    unitId: Joi.number().optional().messages({'number.base' : 'Please select unit'}),
    description : Joi.string().allow(''),
    sizes : Joi.array().items({
        sizeId : Joi.number().required().messages({ 'number.required' : "Please select at least one size" }),
        quantity : Joi.number().min(0).messages({ 'number.min' : 'Quantity must be equal or greater than 0', 'any.required' : 'Quantity required', 'number.base' : 'Invalid quantity'}), 
        cost : Joi.number().precision(2).min(0).messages({ 'number.min' : 'Cost must be equal or greater than 0', 'number.precision' : "Invalid cost price", 'any.required' : "Cost price required", 'number.base' : 'Invalid cost price'}),
    }).min(1).required().messages({'array.base' : 'Please select at least one size', 'any.required' : 'Please select at least one size', 'array.min' : 'Please select at least one size'})
});

export async function addProduct(req: Request, res: Response) {
    try {
        // Validate request body
        const { error, value } = productSchema.validate(req.body);
        if (error) {
            res.status(400).json({ message: error.details[0].message });
            return
        }
        const { name, unitId , description, sizes} = value;
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
            await tx.transactionItems.createMany({
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
            select : {
                id : true, 
                name : true,
                selling_price : true,
                created_at : true,
                product_sizes : {
                    select : {
                        sizes : {
                            select : {
                                id : true,
                                name : true,
                            }
                        },
                        transactions : {
                            select : {
                                cost : true,
                                remaining_quantity : true,
                                transactions : {
                                    select : {
                                        transaction_type : true
                                    }
                                }
                            }
                        }
                    }
                },
                unit : {
                    select : {
                        name : true
                    }
                }
            }
        })
        const processedProducts = products.map(product => {
            const sizesSummary = product.product_sizes.map(productSizes  => {
                //
                return ({
                    id : productSizes.sizes?.id, 
                    name : productSizes.sizes?.name || 'Unknown',
                    currentStock : 0, 
                    cost : 0,
                })
            })
            return({
                id : product.id,  
                name : product.name, 
                unit : product.unit?.name, 
                cost : product.product_sizes.map(productSize => productSize.transactions.filter(element => element.transactions?.transaction_type === 'manufacturing' || element.transactions?.transaction_type === 'adjustment')).map(element => element.reduce((init, accum) => init + Number(accum.cost), 0)),
                sellingPrice : product.selling_price,
                data : product.product_sizes.map(productSize => {
                    const remainingQuantity = productSize.transactions.filter(transaction => Number(transaction.remaining_quantity) > 0).reduce((init, accum) => init + Number(accum.remaining_quantity), 0)
                    return ({ 
                        size : productSize.sizes?.name,
                        remainingQuantity,
                    })
                }),
                quantity : product.product_sizes.map(productSize => {
                    const remainingQuantity = productSize.transactions.filter(transaction => Number(transaction.remaining_quantity) > 0).reduce((init, accum) => init + Number(accum.remaining_quantity), 0)
                    return ({ 
                        size : productSize.sizes?.name,
                        remainingQuantity,
                    })
                }).reduce((innit, accum) => innit + accum.remainingQuantity, 0),
                sizes : sizesSummary,
            })
        })
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
            select: {
                id : true, 
                name : true, 
                description : true, 
                selling_price : true,
                unit: {
                    select: {
                        name: true,
                        symbol: true,
                        id : true
                    }
                },
                product_sizes: {
                    select: {
                        id : true,
                        product_id : true, 
                        sizes: true, // Changed from size to sizes based on schema
                        transactions: {
                            select: {
                                color : {
                                    select : {
                                        name : true,
                                    }
                                },
                                cost : true,
                                remaining_quantity : true,
                                product_size_id : true,
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
                        bom_date : true,
                        quantity : true,
                        bom_list: {
                            select: {
                                quantity : true,
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
            
            // Find the latest transaction with a cost
            const latestTransaction = productSize.transactions
                .sort((a, b) => new Date(b.transactions?.transaction_date || 0).getTime() - 
                                new Date(a.transactions?.transaction_date || 0).getTime())
                .find(t => t.cost !== null);
            
            latestCostPrice = Number(latestTransaction?.cost) || 0;
            //Calculating quantity for this size 
            const quantity = product
                .product_sizes.filter(size => size.product_id === product.id)
                .map(transItem => transItem.transactions)
                .find(tran => {
                    const quantityOfThisProduct = tran.filter(t => t.product_size_id === productSize.id)
                    return quantityOfThisProduct.length
                })?.reduce((init, sum) => init + Number(sum.remaining_quantity), 0)

            return {
                sizeName: productSize.sizes?.name,
                sizeId: productSize.sizes?.id,
                quantity,
                cost : latestCostPrice,
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
            unitId: product.unit?.id,
            unitName : product.unit?.name,
            unitSymbol : product.unit?.symbol,
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
        const { error, value } = updateProductSchema.validate(req.body);
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
                    remaining_quantity : size.quantity,
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

export async function fetchProductsForInvoicing(req: Request, res: Response) {
    try {
        const products = await prisma.product.findMany({
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
            const rawSizes = product.product_sizes.flatMap(size => 
                size.transactions
                    .filter(trans => trans.color && Number(trans.remaining_quantity) > 0)
                    .map(trans => ({
                        sizeId: size.sizes?.id,
                        sizeName: size.sizes?.name,
                        colorId: trans.color?.id,
                        color: trans.color?.name,
                        quantity: Number(trans.remaining_quantity),
                        cost: Number(trans.cost)
                    }))
            );

            // Combine duplicates
            const combinedSizes = rawSizes.reduce((acc, curr) => {
                const existing = acc.find(item => 
                    item.sizeId === curr.sizeId && 
                    item.colorId === curr.colorId
                );

                if (existing) {
                    existing.quantity += curr.quantity;
                    if (curr.cost > 0) {
                        existing.cost = curr.cost;
                    }
                } else {
                    acc.push({ ...curr });
                }
                return acc;
            }, [] as Array<{
                sizeId: number | undefined;
                sizeName: string | undefined;
                colorId: number | undefined;
                color: string | undefined;
                quantity: number;
                cost: number;
            }>);

            return {
                name: product.name,
                id: product.id,
                sellingPrice: Number(product.selling_price),
                sizes: combinedSizes
            };
        }).filter(product => product.sizes.length > 0);

        res.status(200).json(processedProducts);
    } catch (err) {
        console.error('Error in fetchProductsForInvoicing:', err);
        res.status(500).json({ message: 'Server error occurred while fetching products' });
    }
}