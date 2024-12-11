import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import Joi from 'joi'

type RawMaterial = {
    materialId : number;
    quantity : number; 
    cost : number;
}
type PurchasePayload = {
    supplierId : number,
    purchaseDate : Date, 
    rawMaterials : RawMaterial[]
}
const addPurchaseSchema = Joi.object({
    supplierId : Joi.number(),
    purchaseDate : Joi.date().default(new Date()), 
    rawMaterials : Joi.array().items({
        materialId : Joi.number(), 
        quantity : Joi.number().min(1), 
        cost : Joi.number()
    })
})
export async function addPurchase (req: Request, res:Response) {
    try{
        const { error, value } = addPurchaseSchema.validate(req.body);
        if(error){
            res.status(400).json(error.details[0].message)
        }
        const { rawMaterials, supplierId, purchaseDate } : PurchasePayload = value 
        //add a prisma transaction 
        const addPrismaTransaction = await prisma.$transaction(async (tx) => {
            //Add a purchase transaction
            const addTransaction = await tx.transaction.create({
                data : {
                    transaction_date : purchaseDate, 
                    transaction_type : 'purchase'
                }
            })
            //Process transaction item data 
            const rawMaterialsToAdd = rawMaterials.map(rawMaterial => ({
                material_id : rawMaterial.materialId, 
                cost : rawMaterial.cost, 
                transaction_id : addTransaction.id, 
                quantity : rawMaterial.quantity, 
                remaining_quantity : rawMaterial.quantity
            }))
            //Add transaction items 
            const addTransactionItmes = await tx.transactionItems.createMany({
                data : rawMaterialsToAdd
            })

        })
        res.status(201).json({ message : 'success'})
        
    }catch(err){
        res.status(500).json({ message : 'Server error'})
    }
}