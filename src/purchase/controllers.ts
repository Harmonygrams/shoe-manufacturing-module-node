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
const editPurchaseSchema = Joi.object({
    purchaseId : validateSchema.idField('Purchase'),
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
export async function getPurchase(req: Request, res: Response) {
    try {
        const { id } = req.params;

        if (isNaN(Number(id))) {
            res.status(400).json({ message: 'Invalid purchase ID' });
            return 
        }

        const purchase = await prisma.transaction.findFirst({
            where: {
                id: Number(id),
                transaction_type: 'purchase'
            },
            select: {
                id: true,
                transaction_date: true,
                created_at: true,
                supplier: {
                    select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        business_name: true,
                        supplier_type: true,
                        email: true,
                        phone: true,
                        address: true
                    }
                },
                transaction_items: {
                    select: {
                        id: true,
                        quantity: true,
                        remaining_quantity: true,
                        cost: true,
                        raw_material: {
                            select: {
                                id: true,
                                name: true,
                                unit: {
                                    select: {
                                        name: true,
                                        symbol: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!purchase) {
            res.status(404).json({ message: 'Purchase not found' });
            return 
        }

        const processedPurchase = {
            id: purchase.id,
            date: purchase.transaction_date,
            createdAt: purchase.created_at,
            supplier: {
                id: purchase.supplier?.id,
                name: purchase.supplier?.supplier_type === 'business' 
                    ? purchase.supplier.business_name 
                    : `${purchase.supplier?.first_name} ${purchase.supplier?.last_name}`,
                email: purchase.supplier?.email,
                phone: purchase.supplier?.phone,
                address: purchase.supplier?.address
            },
            materials: purchase.transaction_items.map(item => ({
                id: item.id,
                materialId: item.raw_material?.id,
                materialName: item.raw_material?.name,
                quantity: Number(item.quantity),
                remainingQuantity: Number(item.remaining_quantity),
                unitCost: Number(item.cost),
                totalCost: Number(item.quantity) * Number(item.cost),
                unit: item.raw_material?.unit?.symbol,
                usedQuantity: Number(item.quantity) - Number(item.remaining_quantity)
            })),
            summary: {
                totalCost: purchase.transaction_items.reduce((sum, item) => 
                    sum + (Number(item.quantity) * Number(item.cost)), 0),
                totalItems: purchase.transaction_items.length,
                totalQuantity: purchase.transaction_items.reduce((sum, item) => 
                    sum + Number(item.quantity), 0),
                remainingQuantity: purchase.transaction_items.reduce((sum, item) => 
                    sum + Number(item.remaining_quantity), 0)
            }
        };

        res.status(200).json(processedPurchase);
    } catch (err) {
        console.error('Error in getPurchase:', err);
        res.status(500).json({ message: 'Failed to fetch purchase details' });
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
export async function deletePurchase(req: Request, res: Response) {
    try {
        const { id } = req.params;

        if (isNaN(Number(id))) {
            res.status(400).json({ message: 'Invalid purchase ID' });
            return 
        }

        await prisma.$transaction(async (tx) => {
            // First check if purchase exists and is of type 'purchase'
            const purchase = await tx.transaction.findFirst({
                where: {
                    id: Number(id),
                    transaction_type: 'purchase'
                },
                include: {
                    transaction_items: {
                        where: {
                            remaining_quantity: {
                                gt: 0
                            }
                        }
                    }
                }
            });

            if (!purchase) {
                throw new Error('Purchase not found');
            }

            // Check if any materials from this purchase have been used
            if (purchase.transaction_items.some(item => 
                Number(item.quantity) !== Number(item.remaining_quantity))) {
                throw new Error('Cannot delete purchase as some materials have already been used');
            }

            // Delete transaction items first
            await tx.transactionItems.deleteMany({
                where: {
                    transaction_id: Number(id)
                }
            });

            // Delete the purchase transaction
            await tx.transaction.delete({
                where: {
                    id: Number(id)
                }
            });
        });

        res.status(200).json({ message: 'Purchase deleted successfully' });
    } catch (err) {
        console.error('Error in deletePurchase:', err);
        res.status(400).json({
            message: err instanceof Error ? err.message : 'Failed to delete purchase'
        });
    }
}
export async function editPurchase(req: Request, res: Response) {
    try {
        const { error, value } = editPurchaseSchema.validate(req.body);
        if (error) {
            res.status(400).json({ message: error.details[0].message });
            return;
        }

        const { purchaseId, rawMaterials, supplierId, purchaseDate } = value;

        await prisma.$transaction(async (tx) => {
            // Check if purchase exists and is of type 'purchase'
            const existingPurchase = await tx.transaction.findFirst({
                where: {
                    id: purchaseId,
                    transaction_type: 'purchase'
                },
                include: {
                    transaction_items: {
                        select: {
                            quantity: true,
                            remaining_quantity: true
                        }
                    }
                }
            });

            if (!existingPurchase) {
                throw new Error('Purchase not found');
            }

            // Check if any materials have been used
            if (existingPurchase.transaction_items.some(item => 
                Number(item.quantity) !== Number(item.remaining_quantity))) {
                throw new Error('Cannot edit purchase as some materials have already been used');
            }

            // Update the main purchase transaction
            await tx.transaction.update({
                where: { id: purchaseId },
                data: {
                    supplier_id: supplierId,
                    transaction_date: purchaseDate,
                }
            });

            // Delete existing transaction items
            await tx.transactionItems.deleteMany({
                where: { transaction_id: purchaseId }
            });

            // Create new transaction items
            const rawMaterialsToAdd = rawMaterials.map((rawMaterial : { materialId : number, cost : number, quantity : number; }) => ({
                material_id: rawMaterial.materialId,
                cost: rawMaterial.cost,
                transaction_id: purchaseId,
                quantity: rawMaterial.quantity,
                remaining_quantity: rawMaterial.quantity
            }));

            await tx.transactionItems.createMany({
                data: rawMaterialsToAdd
            });
        });

        res.status(200).json({ message: 'Purchase updated successfully' });
    } catch (err) {
        console.error('Error in editPurchase:', err);
        res.status(400).json({
            message: err instanceof Error ? err.message : 'Failed to update purchase'
        });
    }
}