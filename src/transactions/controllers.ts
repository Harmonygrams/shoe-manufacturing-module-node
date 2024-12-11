import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import Joi from "joi";

const addOpeningStockTransactionSchema = Joi.object({
    materialId : Joi.string().allow(''),
    transactionDate : Joi.date().default(new Date()),
    transactionItems : Joi.array().items({
        transactionId : Joi.string(), 
        materialId : Joi.string(),
        productId : Joi.string(), 
        quantity : Joi.number().min(1).required(),
        cost : Joi.number().min(0).required(),
        productSizeId : Joi.number(),      
    })
})
export async function addOpeningStock (req: Request, res:Response) {
    try {
        const { transactionType, transactionDate,  transactionItems} = req.body;
        if(transactionType === "opening_stock"){
            const addOpeningStockTransaction = prisma.$transaction(async (tx) => {
                const updateOpeningStock = await tx.transaction.create({ 
                    data : {
                        transaction_type : 'opening_stock',
                       transaction_date : transactionDate
                    }
                })
                //All transactions 
                const openingStockItems = transactionItems.map((transactionItem : any)=> {
                    return {
                        transaction_id : transactionItem.transactionId,
                        quantity : transactionItem.quantity, 
                        const : transactionItem.cost, 
                        material_id : transactionItem.materialId,
                        product_size_id : transactionItem.productSizeId, 
                        
                    }
                })
                await tx.transactionItems.createMany({
                    data : openingStockItems
                })
            })
            res.status(201).json({ message : 'Opening stock updated '})
            return;
        }
        res.status(400).json({ message : 'Please specify transaction type'})
    }catch(err){
        console.log(err)
        res.status(500).json({ message : "Server error occurred"})
    }
    
}

export async function addAdjustment () {}
export async function addPurchase (req:Request, res:Response) {
    // try {
    //     const { transactionType, quantity, cost, materialId, productId, transactionDate,  } = req.body;
    //     if(transactionType === "purchase"){
    //         const newPurchase = await prisma.transaction.create({
    //             data : {
    //                 transaction_type : 'purchase',
    //                 transaction_date : transactionDate,
    //                 quantity, 
    //                 cost, 
    //                 material_id : materialId, 
    //                 product_id : productId,
    //             }
    //         })
    //         res.status(201).json({ message : 'Purchase added successfully'})
    //         return 
    //     }
    //     res.status(400).json({ message : 'Please specify transaction type'})
    // }catch(err){
    //     console.log(err)
    //     res.status(500).json({ message : 'Server error occurred'})
    // }
}
export async function addSale () {}
