import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import Joi = require("joi");
type RawMaterial = {
    materialId : number; 
    quantity : number; 
}
type Product = {
    productId : number; 
    sizeId : number;
    colorId : number;
    quantity : number;
}
type ProductionLayload = { products : Product[], rawMaterials : RawMaterial[], status : string, productionDate : Date}
const addProductSchema = Joi.object({
    productionDate : Joi.date().default(new Date()),
    status : Joi.string().required(),
    products : Joi.array().items({
        productId : Joi.number(),
        sizeId : Joi.number(), 
        colorId : Joi.number(),
        quantity : Joi.number(),
    }), 
    rawMaterials : Joi.array().items({
        materialId : Joi.number(), 
        quantity : Joi.number(),
    }), 
    productionCosts : Joi.array()
})
export async function addProduction (req : Request, res: Response) {
    try{
        //Validate fields 
        const { error, value } = addProductSchema.validate(req.body);
        if(error){
            res.status(400).json(error.details[0].message);
            return;
        }   
        const { products, rawMaterials, status, productionDate } : ProductionLayload = value
        //Add prisma transaction 
        const addProductionTxn = await prisma.$transaction(async (tx) => {
            const processProductSizes = products.map(product => product.productId)
            //Fetch product size ids
            const fetchProductSizeIds = await prisma.productSize.findMany({
                where : {
                    product_id : {
                        in : processProductSizes
                    }
                },
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
                data : {
                    transaction_date : productionDate,
                    transaction_type : 'production', 
                    manufacturing_status : 'cutting'
                }
            })
            //Add product sizes to an array 
            const productToAddToSizeItems = []
            for(const product of products){
                for(const productSizeId of fetchProductSizeIds){
                    if(product.sizeId === productSizeId.size_id && product.productId === productSizeId.product_id){
                        const productToAdd = {
                            color_id : product.colorId, 
                            product_size_id : productSizeId.id, 
                            cost : 0,
                            transaction_id : addTransaction.id, 
                            remaining_quantity : product.quantity, 
                            quantity : product.quantity
                        }
                        productToAddToSizeItems.push(productToAdd)
                    }
                }
            }
            //Add products to transaction items 
            const appProducts = await tx.transactionItems.createMany({
                data : productToAddToSizeItems
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
        const processProductions = await fetchProductions.map(product => ({
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
export async function getProduction (req:Request, res:Response) {}
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