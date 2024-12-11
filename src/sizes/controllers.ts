import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import Joi from "joi";
import { prisma } from "../lib/prisma";

const sizeSchema = Joi.object({
    name: Joi.string().required(),
})

export async function addSize(req: Request, res: Response) {
    try {
        // Validate the product added
        const { error, value } = sizeSchema.validate(req.body);
        if (error) {
            res.status(400).json(error.details[0].message)
            return;
        }

        const { name } = value;
        const addSize = await prisma.size.create({
            data: {
                name
            }
        })

        res.status(201).json({ message: 'Size added successfully' })
    } catch (err) {
        res.status(500).json({ message: "Server error occurred" })
    }
}

export async function getSize(req: Request, res: Response) {
    try {
        const { id } = req.params;

        const size = await prisma.size.findUnique({
            where: {
                id: parseInt(id)
            }
        });

        if (!size) {
            res.status(404).json({ message: "Size not found" });
            return;
        }

        res.status(200).json(size);
    } catch (err) {
        res.status(500).json({ message: "Server error occurred" });
    }
}

export async function getSizes(req: Request, res: Response) {
    try {
        const sizes = await prisma.size.findMany({
            orderBy: {
                name: 'asc'
            }
        });

        res.status(200).json(sizes);
    } catch (err) {
        res.status(500).json({ message: "Server error occurred" });
    }
}

export async function updateSize(req: Request, res: Response) {
    try {
        const { id } = req.params;
        
        // Validate the update data
        const { error, value } = sizeSchema.validate(req.body);
        if (error) {
            res.status(400).json(error.details[0].message);
            return;
        }

        // Check if size exists
        const existingSize = await prisma.size.findUnique({
            where: {
                id: parseInt(id)
            }
        });

        if (!existingSize) {
            res.status(404).json({ message: "Size not found" });
            return;
        }

        const { name } = value;
        const updatedSize = await prisma.size.update({
            where: {
                id: parseInt(id)
            },
            data: {
                name
            }
        });

        res.status(200).json({ message: "Size updated successfully" });
    } catch (err) {
        res.status(500).json({ message: "Server error occurred" });
    }
}

export async function deleteSize(req: Request, res: Response) {
    try {
        const { id } = req.params;

        // Check if size exists
        const existingSize = await prisma.size.findUnique({
            where: {
                id: parseInt(id)
            }
        });

        if (!existingSize) {
            res.status(404).json({ message: "Size not found" });
            return;
        }

        await prisma.size.delete({
            where: {
                id: parseInt(id)
            }
        });

        res.status(200).json({ message: "Size deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: "Server error occurred" });
    }
}