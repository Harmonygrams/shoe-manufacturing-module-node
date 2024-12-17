import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import Joi, { array, number } from 'joi'
import { validateSchema } from "../configs/schema";
import { URLSearchParams } from "url";

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
type Supplier = {
    id : number | null;
    name: string | null;
}
type Data = {
    id : number, 
    supplier : Supplier,
    date : Date; 
    totalCost : number; 
    materialCount : number; 
}
type Page = {
    data : Data[];
    nextCursor? : number; 
    prevCursor? : number;
}
const addPurchaseSchema = Joi.object({
    supplierId : validateSchema.idField('Supplier'),
    purchaseDate : validateSchema.dateField('Purchase date'), 
    rawMaterials : validateSchema.arrayField('Raw materials').items({
        materialId : validateSchema.idField('Raw Material'),
        name : Joi.string(),
        quantity : validateSchema.quantity(),
        cost : validateSchema.cost()
    }).min(1).required().messages({'array.min' : 'Please select at least one raw material', 'any.required' : 'Please select at least one raw material'})
})
export async function addPurchase (req: Request, res:Response) {
    try{
        const { error, value } = addPurchaseSchema.validate(req.body);
        if(error){
            res.status(400).json({message : error.details[0].message})
            return; 
        }
        const { rawMaterials, supplierId, purchaseDate } : PurchasePayload = value 
        //add a prisma transaction 
        const addPrismaTransaction = await prisma.$transaction(async (tx) => {
            //Add a purchase transaction
            const addTransaction = await tx.transaction.create({
                data : {
                    supplier_id : supplierId,
                    transaction_date : purchaseDate, 
                    transaction_type : 'purchase', 
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
        console.log(err);
        res.status(500).json({ message : 'Server error'})
    }
}
export async function getPurchases (req:Request, res:Response) {
    try{
        const { cursor } = req.query;
        const fetchPurchases = await prisma.transaction.findMany({
            where : {
                transaction_type : 'purchase',
            }, 
            ...(cursor && {
                cursor : {
                    id : Number(cursor),
                },
                skip : 1,
            }),
            take : 10,
            select : {
                id : true, 
                created_at : true, 
                transaction_date : true,
                supplier : {
                    select : {
                        id : true,
                        first_name : true,
                        last_name : true, 
                        business_name : true, 
                        supplier_type : true,
                    }
                }, 
                transaction_items : true,
            }, 
            orderBy : {
                created_at : 'desc'
            }
        })

        const purchases = fetchPurchases.map(purchase => ({ 
                id: purchase.id,
                supplier: {
                    id : purchase.supplier ? purchase.supplier.id : null,
                    name: purchase.supplier ? (purchase.supplier.supplier_type === 'business' ? purchase.supplier.business_name : `${purchase.supplier?.first_name} ${purchase.supplier?.last_name}`) : null
                },
                date: purchase.transaction_date,
                materialCount : purchase.transaction_items.length,
                totalCost: purchase.transaction_items.reduce((init, sum) => init + Number(sum.cost), 0)
        }))
        const page : Page = {
            data : purchases,
            nextCursor : purchases[purchases.length - 1].id,
        }
        res.status(200).json(page)
    }catch(err){
        console.log(err); 
        res.status(500).json({ message : 'Server error occurred'})
    }
}