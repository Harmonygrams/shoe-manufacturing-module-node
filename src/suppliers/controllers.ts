import { Request, Response } from 'express'
import { prisma } from "../lib/prisma";
import Joi from 'joi';

export async function addSupplier (req: Request, res : Response) {
    try {
    const { firstName, lastName, businessName, phone, email, supplierType, address } = req.body;
        //Validate supplier data 
        if (!supplierType) {
            res.status(401).json({ message: 'Specify supplier type' })
            return 
        }
        if (supplierType === 'individual' && !firstName) {
            res.status(401).json({ message: 'First name required' })
            return 
        }
        if (supplierType === 'business' && !businessName) {
            res.status(401).json({ message: 'Business name required' })
            return 
        }
        // Save to database 
        await prisma.supplier.create({
            data: {
                first_name: firstName,
                last_name: lastName,
                business_name: businessName,
                email,
                phone: phone,
                address,
                supplier_type: supplierType
            }
        })
        res.status(201).json({ message: 'Supplier added' })
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: 'Server error' })
    }
    
}
export async function getSupplier (req: Request, res : Response) {
    try { 
        const { id }  = req.params; 
        if(!id){
            res.status(400).json({ message : "Invalid supplier id "})
            return
        }
        const fetchSupplier = await prisma.supplier.findFirst({
            where : {
                id : parseInt(id)
            }, 
            select : {
                supplier_type : true, 
                business_name : true, 
                first_name : true, 
                last_name : true, 
                phone : true, 
                email : true, 
                address : true, 
            }
        })
        if(!fetchSupplier){
            res.status(404).json({ message : "Supplier not found "})
            return;
        }
        const response = {
            supplierType : fetchSupplier.supplier_type, 
            businessName : fetchSupplier.business_name, 
            firstName : fetchSupplier.first_name, 
            lastName : fetchSupplier.last_name, 
            phone : fetchSupplier.phone,
            email : fetchSupplier.email,
            address : fetchSupplier.address,
        }
        res.status(200).json(response)
    }catch(err){
        console.log(err)
        res.status(500).json({ message: 'Server error' })
    }
}
export async function getSuppliers (req: Request, res : Response) {
    try {
        const fetchSuppliers = await prisma.supplier.findMany({
            orderBy: {
                created_at: 'desc'
            }
        });
        const suppliers = fetchSuppliers.map(supplier => ({
            id : supplier.id,
            supplierName : supplier.supplier_type === 'individual' ? `${supplier.first_name} ${supplier.last_name}` : `${supplier.business_name}`, 
            email : supplier.email, 
            phone : supplier.phone, 
            address : supplier.address, 
            createdAt : supplier.created_at
        }))
        res.status(200).json(suppliers);
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: 'Server error' });
    }
}
export async function updateSupplier (req: Request, res : Response) {}
export async function deleteSupplier (req: Request, res : Response) {}