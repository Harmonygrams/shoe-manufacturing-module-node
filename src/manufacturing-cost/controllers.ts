import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { validateSchema } from '../configs/schema';
import Joi from 'joi';

const manufacturingCostSchema = Joi.object({
    name: Joi.string().required().messages({
            
        'any.required': 'Cost name is required'
    }),
    amount : validateSchema.cost(),
});

export async function addManufacturingCost(req: Request, res: Response) {
    try {
        const { error, value } = manufacturingCostSchema.validate(req.body);
        if (error) {
            res.status(400).json({ message: error.details[0].message });
            return 
        }

        const { name, amount } = value;

        // Check if cost name already exists
        const existingCost = await prisma.manufacturingCost.findFirst({
            where: {
                name: {
                    equals: name,
                }
            }
        });

        if (existingCost) {
            res.status(400).json({ message: 'Manufacturing cost name already exists' });
            return 
        }

        const newCost = await prisma.manufacturingCost.create({
            data: {
                name,
                cost : amount,
            }
        });

        res.status(201).json({
            message: 'Manufacturing cost added successfully',
            cost: newCost
        });
    } catch (err) {
        console.error('Error in addManufacturingCost:', err);
        res.status(500).json({ message: 'Failed to add manufacturing cost' });
    }
}

export async function editManufacturingCost(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const { error, value } = manufacturingCostSchema.validate(req.body);
        
        if (error) {
            res.status(400).json({ message: error.details[0].message });
            return 
        }

        if (isNaN(Number(id))) {
            res.status(400).json({ message: 'Invalid cost ID' });
            return 
        }

        const { name, amount } = value;

        // Check if the cost exists
        const existingCost = await prisma.manufacturingCost.findUnique({
            where: { id: Number(id) }
        });

        if (!existingCost) {
            res.status(404).json({ message: 'Manufacturing cost not found' });
            return 
        }

        // Check for name conflicts (excluding current cost)
        const nameConflict = await prisma.manufacturingCost.findFirst({
            where: {
                name,
                id: {
                    not: Number(id)
                }
            }
        });

        if (nameConflict) {
            res.status(400).json({ message: 'Manufacturing cost name already exists' });
            return 
        }

        const updatedCost = await prisma.manufacturingCost.update({
            where: { id: Number(id) },
            data: { name, cost : amount }
        });

        res.status(200).json({
            message: 'Manufacturing cost updated successfully',
            cost: updatedCost
        });

    } catch (err) {
        console.error('Error in editManufacturingCost:', err);
        res.status(500).json({ message: 'Failed to update manufacturing cost' });
    }
}

export async function deleteManufacturingCost(req: Request, res: Response) {
    try {
        const { id } = req.params;

        if (isNaN(Number(id))) {
            res.status(400).json({ message: 'Invalid cost ID' });
            return 
        }

        // Check if cost exists and is being used in any transactions
        const cost = await prisma.manufacturingCost.findUnique({
            where: { id: Number(id) }
        });
        if (!cost) {
            res.status(404).json({ message: 'Manufacturing cost not found' });
            return 
        }
        await prisma.manufacturingCost.delete({
            where: { id: Number(id) }
        });

        res.status(200).json({ message: 'Manufacturing cost deleted successfully' });
    } catch (err) {
        console.error('Error in deleteManufacturingCost:', err);
        res.status(500).json({ message: 'Failed to delete manufacturing cost' });
    }
}

export async function getManufacturingCosts(req: Request, res: Response) {
    try {
        const costs = await prisma.manufacturingCost.findMany({
            select: {
                id: true,
                name: true,
                cost : true,
            },
            orderBy: {
                name: 'asc'
            }
        });
        const processedCosts = costs.map(cost => ({
            name : cost.name, 
            amount : cost.cost, 
            id : cost.id
        }))
        res.status(200).json(processedCosts);
    } catch (err) {
        console.error('Error in getManufacturingCosts:', err);
        res.status(500).json({ message: 'Failed to fetch manufacturing costs' });
    }
}

