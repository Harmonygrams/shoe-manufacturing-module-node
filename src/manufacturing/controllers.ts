import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import Joi = require("joi");
import { validateSchema } from "../configs/schema";
type RawMaterial = {
    materialId : number; 
    quantity : number; 
}
type Product = {
    productId : number; 
    sizeId : number;
    colorId : number;
    quantity : number;
    unitCost : number;
}
type Status = 'cutting' | 'sticking' | 'lasting' | 'finished'

type ProductionLayload = { products : Product[], rawMaterials : RawMaterial[], status : Status, productionDate : Date, orderType : 'manufacturing' | 'sale', orderId : number, productionCosts: { costId: number, cost: number }[] }
const addProductSchema = Joi.object({
    productionDate : Joi.date().default(new Date()),
    status : Joi.string().required(),
    orderType : Joi.string().required().messages({'string.empty' : 'Select a pending production order', 'any.required' : 'Select a pending production order'}),
    orderId : Joi.number().required(),
    products : Joi.array().items({
        productId : Joi.number(),
        sizeId : Joi.number(), 
        colorId : Joi.number(),
        unitCost : validateSchema.cost(),
        quantity : Joi.number(),
    }), 
    rawMaterials : Joi.array().items({
        materialId : Joi.number(), 
        quantity : Joi.number(),
    }), 
    productionCosts: Joi.array().items({
        costId: Joi.number().required(),
        cost: Joi.number().required()
    }).required()
})
export async function addProduction (req : Request, res: Response) {
    try{
        //Validate fields 
        const { error, value } = addProductSchema.validate(req.body);
        if(error){
            res.status(400).json(error.details[0].message);
            return;
        }   
        
        const { products, rawMaterials, status, productionDate, orderId, productionCosts } : ProductionLayload = value
        //Add prisma transaction 
        await prisma.$transaction(async (tx) => {
            const processProductSizes = products.map(product => product.productId)
            //Fetch product size ids
            const fetchProductSizeIds = await prisma.productSize.findMany({
                where : {
                    product_id : {
                        in : processProductSizes
                    },
                },
                select : {
                    size_id : true,
                    product_id : true,
                    id : true,
                    products : {
                        select : {
                            bom : {
                                select : {
                                    bom_list : {
                                        select : {
                                            material : {
                                                select : {
                                                    transactionItems : {
                                                        select : {
                                                            cost : true, 
                                                            quantity: true,
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
            })
            // Know the remaining quantity of the raw materials using their ids 
            const rawMaterialsId = rawMaterials.map(rawMaterial => rawMaterial.materialId)
            const getRawMaterialsFromDb = await prisma.rawMaterials.findMany({
                where : {
                    id : {
                        in : rawMaterialsId
                    }, 
                }, 
                select : {
                    name : true,
                    id : true,
                    transactionItems : {
                        where : {
                            remaining_quantity : {
                                gt : 0,
                            },
                            transactions : {
                                transaction_type : {
                                    in : ['adjustment', 'opening_stock', 'purchase'],
                                }
                            },
                        },
                        select : {
                            id : true,
                            remaining_quantity : true,
                            transactions : true
                    }}
                }
            })
            //We have to ensure that we have upto the quantity of the materials needed
            for(const rawMaterial of rawMaterials){
                for(const rawMaterialFromDb of getRawMaterialsFromDb){
                    if(rawMaterial.materialId === rawMaterialFromDb.id){
                        const totalQuantityRemaining = rawMaterialFromDb.transactionItems.reduce((initial, accum) => initial + Number(accum.remaining_quantity), 0)
                        if(totalQuantityRemaining < rawMaterial.quantity){
                            throw new Error(`${rawMaterialFromDb.name} is insufficient. \nRequired Quantity: ${rawMaterial.quantity}\nRemaining Quantity: ${totalQuantityRemaining}`)
                        } 
                    }
                }
            }
            //Find out the batches with the oldest dates with remaining quantity and minus from there 
            for(const rawMaterial of rawMaterials){
                for(const rawMaterialFromDb of getRawMaterialsFromDb){
                    if(rawMaterial.materialId === rawMaterialFromDb.id){
                        let quantityNeeded = rawMaterial.quantity
                        //For when the quantity needed is bigger than in stock
                        for(const transaction of rawMaterialFromDb.transactionItems){
                            if(quantityNeeded === Number(transaction.remaining_quantity)){
                                await tx.transactionItems.update({
                                    where : {
                                        id : transaction.id,
                                        material_id : rawMaterialFromDb.id
                                    }, 
                                    data : {
                                        remaining_quantity : 0
                                    }
                                })
                                quantityNeeded = 0   
                            }
                            if(quantityNeeded > Number(transaction.remaining_quantity) && quantityNeeded > 0){
                                await tx.transactionItems.update({
                                    where : {
                                        id : transaction.id,
                                        material_id : rawMaterialFromDb.id
                                    }, 
                                    data : {
                                        remaining_quantity : 0
                                    }
                                })
                                quantityNeeded = quantityNeeded - Number(transaction.remaining_quantity)
                            }
                            //For  when quantity needed is less than the quantity in stock
                            if(quantityNeeded < Number(transaction.remaining_quantity) && quantityNeeded > 0){
                                await tx.transactionItems.update({
                                    where : {
                                        id : transaction.id,
                                        material_id : rawMaterialFromDb.id
                                    }, 
                                    data : {
                                        remaining_quantity : Number(transaction.remaining_quantity) - quantityNeeded
                                    }
                                })
                                quantityNeeded = 0
                            }
                        }
                    }
                }
            }
            // Update the material quantity on the database 
            const addTransaction = await tx.transaction.create({
                data: {
                    transaction_date: productionDate,
                    transaction_type: 'production',
                    manufacturing_status: status,
                    manufaction_costs: {
                        create: productionCosts.map(cost => ({
                            name: String(cost.cost),
                            transaction_id: undefined // This will be automatically set by the relation
                        }))
                    }
                }
            });

            // Calculate total manufacturing cost
            const totalManufacturingCost = productionCosts.reduce((sum, cost) => sum + Number(cost.cost), 0);
            const manufacturingCostPerUnit = totalManufacturingCost / products.reduce((sum, product) => sum + product.quantity, 0);

            //Add product sizes to an array 
            const productToAddToSizeItems = []
            for(const product of products){
                for(const productSizeId of fetchProductSizeIds){
                    if(product.sizeId === productSizeId.size_id && product.productId === productSizeId.product_id){
                        console.log(product.quantity)
                        const productToAdd = {
                            color_id : product.colorId, 
                            product_size_id : productSizeId.id, 
                            cost : Number(product.unitCost) + manufacturingCostPerUnit, // Add manufacturing cost per unit
                            transaction_id : addTransaction.id, 
                            ...(addTransaction.manufacturing_status === 'finished' && {
                                quantity : product.quantity, 
                                remaining_quantity : product.quantity, 
                                pending_quantity : 0
                            }),
                            pending_quantity : product.quantity, 
                        }
                        productToAddToSizeItems.push(productToAdd)
                    }
                }
            }
            //Add products to transaction items 
            await tx.transactionItems.createMany({
                data : productToAddToSizeItems
            })
            //Update transaction
            await tx.transaction.update({
                where : {
                    id : orderId,
                }, 
                data : {
                    sale_status : addTransaction.manufacturing_status === 'finished' ? 'fulfilled' : 'processing'
                }
            })
        })
        res.status(201).json({ message : 'Successful'})
    }catch(err){
        const errorMessage = err as Error;
        res.status(400).json(errorMessage.message);
    }
}
export async function getProductions (req:Request, res:Response) {
    try{
        const fetchProductions = await prisma.transaction.findMany({
            where : {
                transaction_type : 'production',
            },
            select : {
                id : true,
                transaction_date : true, 
                manufaction_costs : true, 
                manufacturing_status : true,
            },
            orderBy : {
                created_at : 'desc'
            }
        })
        const processProductions = fetchProductions.map(product => ({
            id : product.id, 
            date : product.transaction_date, 
            cost : product.manufaction_costs.reduce((init, accum) => init + Number(accum.cost), 0), 
            status : product.manufacturing_status
        }))
        res.status(200).json(processProductions);
    }catch(err){
        res.status(500).json({message: "Server error occurred "})
    }
}
export async function getProduction(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const production = await prisma.transaction.findUnique({
            where: {
                id: Number(id),
                transaction_type: 'production'
            },
            select: {
                id: true,
                transaction_date: true,
                manufacturing_status: true,
                manufaction_costs: {
                    select: {
                        id : true,
                        cost : true,
                        name : true,
                    }
                },
                transaction_items: {
                    select: {
                        quantity: true,
                        cost: true,
                        pending_quantity: true,
                        remaining_quantity: true,
                        material_id: true,
                        raw_material: {
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
                        product_size: {
                            select: {
                                products: {
                                    select: {
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
                                        name: true
                                    }
                                }
                            }
                        },
                        color: {
                            select: {
                                name: true,
                                id: true
                            }
                        }
                    }
                }
            }
        });

        if (!production) {
            res.status(404).json({ message: 'Production not found' });
            return 
        }

        // Process the data for frontend consumption
        const processedData = {
            id: production.id,
            date: production.transaction_date,
            status: production.manufacturing_status,
            manufacturingCosts: production.manufaction_costs.map(cost => ({
                id: cost.id,
                name: cost.name,
                cost: Number(cost.cost)
            })),
            products: production.transaction_items
                .filter(item => item.product_size)
                .map(item => ({
                    productName: item.product_size?.products?.name,
                    size: item.product_size?.sizes?.name,
                    color: item.color?.name,
                    quantity: Number(item.quantity),
                    pendingQuantity: Number(item.pending_quantity),
                    remainingQuantity: Number(item.remaining_quantity),
                    unitCost: Number(item.cost),
                    unit: item.product_size?.products?.unit?.symbol
                })),
            rawMaterials: production.transaction_items
                .filter(item => item.material_id !== null && item.raw_material)
                .map(item => ({
                    id: item.raw_material?.id,
                    name: item.raw_material?.name,
                    quantity: Number(item.quantity) || 0,
                    unit: item.raw_material?.unit?.symbol
                }))
        };
        res.status(200).json(processedData);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error occurred' });
    }
}
export async function updateProduction (req:Request, res:Response) {}
export async function deleteProduction (req:Request, res:Response) {}
export async function validateProduction (req:Request, res:Response) {
    try{
        // sales order 
        const { id } = req.query;
    }catch(err){
        console.log(err)
        res.status(500).json({ message : 'Server '})
    }
}