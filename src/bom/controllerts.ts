import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

import Joi from "joi";

const addBillOfMaterialSchema = Joi.object({
    productId : Joi.number().messages({
        'number.base' : "Please select a product", 
        'any.required' : 'Please select a product'
    }), 
    quantity : Joi.number().min(1), 
    bomDate : Joi.date().default(new Date()),
    bomList : Joi.array().min(1).required().items({
        materialId : Joi.number().required().messages({
            'number.base' : "Please select a material", 
            'any.required' : 'Please select a material'
        }), 
        quantity : Joi.number().min(0).required().messages({
            'number.base' : "Quantity is required", 
            'any.required' : 'Quantity is required', 
            'number.min' : 'Quantity must be equal or more than 0'
        }), 
    }).messages({'array.base' : 'Please select at least one raw material', 'array.min' : 'Please select at least one raw material'}),
})

export async function addBillOfMaterial (req: Request, res:Response) {
    try {
        // Validate request body
        const {error, value} = addBillOfMaterialSchema.validate(req.body); 
        if(error){
            console.log(error)
            res.status(400).json({ message: error.details[0].message });
            return 
        }
        const { productId, quantity, bomList, bomDate} = value;
        //Initiate a prisma transaction to add the bill of material 
        const transaction = await prisma.$transaction(async (tx) => {
            const addBillOfMaterialToDb = await tx.billOfMaterials.create({
                data : {
                    product_id : productId,
                    quantity : 1, 
                    bom_date : bomDate,
                }
            })
            const bomListItems = bomList.map((bom : any) => ({
                bom_id : addBillOfMaterialToDb.id,
                material_id : bom.materialId,
                quantity : bom.quantity, 

            }))
            await tx.billOfMaterialsList.createMany({
                data : bomListItems
            })
            return { addBillOfMaterialToDb }
        })                                                                        
        res.status(201).json({ message : "Bom added successfully"})
    }catch(err){
        console.log(err); 
        res.status(500).json({ message : "server error occurred"})
    }
}

export async function getBillsOfMaterial(req: Request, res: Response) {
    try {
        const fetchBillOfMaterials = await prisma.billOfMaterials.findMany({
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                    }
                },
                bom_list: {
                    select : {
                        material_id : true, 
                        material : {
                            select : {
                                name : true,
                                unit : {
                                    select : {
                                        name : true
                                    }
                                },
                                transactionItems : {
                                    select : {
                                        cost : true, 
                                        quantity : true,
                                        remaining_quantity : true,
                                        transactions : true,
                                    },
                                    
                                }
                            }
                        }
                    }
            }}
        })
        const bomItems = fetchBillOfMaterials.map(bomItem => {
            let lastCostPriceTransaction = 0;
            const bomList = bomItem.bom_list.map(bomListItem => {
                // Get the most recent cost price from purchase or opening stock
                const lastTransactionWithCost = bomListItem.material.transactionItems.find(trans => 
                    (trans.transactions?.transaction_type === "purchase" || trans.transactions?.transaction_type === "opening_stock" || trans.transactions?.transaction_type === "adjustment") && trans.cost
                )
                lastCostPriceTransaction = Number(lastTransactionWithCost?.cost) || 0
                return {
                    quantity: bomListItem.material.transactionItems.reduce((initial, accum) => initial + Number(accum.remaining_quantity), 0),
                    materialName: bomListItem.material.name,
                    unit: bomListItem.material.unit?.name,
                    cost: lastCostPriceTransaction
                }
            })
            // Calculate total cost
            const totalCost = bomList.reduce((sum, item) => sum + (item.quantity * item.cost), 0)
            
            return {
                id: bomItem.id,
                productName: bomItem.product.name,
                productId : bomItem.product.id,
                bomDate: bomItem.bom_date,
                bomList,
                totalCost, // Added total cost
            }
        })
        res.status(200).json({ bomItems })
    } catch (err) {
        console.log(err); 
        res.status(500).json({ message: "Server error occurred" })
    }
}
export async function getBillOfMaterial(req: Request, res: Response) {
    try {
        const { id } = req.params;
        // Validate ID is a number
        if (isNaN(Number(id))) {
            res.status(400).json({ message: 'Invalid ID format' });
            return;
        }
        const fetchBillOfMaterial = await prisma.billOfMaterials.findFirst({
            where: {
                product_id : Number(id)
            },
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                    }
                },
                bom_list: {
                    select: {
                        material_id: true,
                        quantity: true,
                        material: {
                            select: {
                                name: true,
                                unit: {
                                    select: {
                                        id : true, 
                                        name : true
                                    }
                                },
                                transactionItems: {
                                    orderBy: {
                                        created_at: 'desc'
                                    },
                                    include : {
                                        transactions : {
                                            select: {
                                                transaction_type: true,
                                                transaction_date: true,
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
        let lastCostPriceTransaction = 0;
        let totalQuantity = 0;
        const bomList = fetchBillOfMaterial?.bom_list.map(bomListItem => {
            // Get the most recent cost price from purchase or opening stock
            const lastTransactionWithCost = bomListItem.material.transactionItems.find(trans =>{
                totalQuantity += Number(trans.quantity)
                return (trans.transactions?.transaction_type === "purchase" || trans.transactions?.transaction_type === "opening_stock" || trans.transactions?.transaction_type === "adjustment") && trans.cost
            }

            )
            lastCostPriceTransaction = Number(lastTransactionWithCost?.cost) || 0
            return {
                name: bomListItem.material.name,
                unitName: bomListItem.material.unit?.name,
                unitId : bomListItem.material.unit?.id,
                cost: lastCostPriceTransaction,
                quantityNeed: bomListItem.quantity,
                totalQuantity,
            }
        })

        // Calculate total cost
        const totalCost = bomList?.reduce((sum, item) => sum + (Number(item.quantityNeed) * item.cost), 0) || 0

        const product = {
            id: fetchBillOfMaterial?.id,
            productName: fetchBillOfMaterial?.product.name,
            bomDate: fetchBillOfMaterial?.bom_date,
            bomList,
            totalCost, // Added total cost
        }
        res.status(200).json(product)
    } catch (err) {
        res.status(500).json({ message: 'Server error occurred' })
    }
}