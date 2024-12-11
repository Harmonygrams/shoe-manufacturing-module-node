import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import Joi from "joi";

const colorSchema = Joi.object({
    name: Joi.string().required(),
})

export async function addColor(req: Request, res: Response) {
    try {
        const { error, value } = colorSchema.validate(req.body);
        if (error) {
            res.status(400).json(error.details[0].message)
            return;
        }

        const { name } = value;
        await prisma.color.create({
            data: { name }
        })

        res.status(201).json({ message: 'Color added successfully' })
    } catch (err) {
        res.status(500).json({ message: "Server error occurred" })
    }
}

export async function getColor(req: Request, res: Response) {
    try {
        const { id } = req.params;

        const color = await prisma.color.findUnique({
            where: { id: parseInt(id) }
        });

        if (!color) {
            res.status(404).json({ message: "Color not found" });
            return;
        }

        res.status(200).json(color);
    } catch (err) {
        res.status(500).json({ message: "Server error occurred" });
    }
}

export async function getColors(req: Request, res: Response) {
    try {
        const colors = await prisma.color.findMany({
            orderBy: { name: 'asc' }
        });

        res.status(200).json(colors);
    } catch (err) {
        res.status(500).json({ message: "Server error occurred" });
    }
}

export async function updateColor(req: Request, res: Response) {
    try {
        const { id } = req.params;
        
        const { error, value } = colorSchema.validate(req.body);
        if (error) {
            res.status(400).json(error.details[0].message);
            return;
        }

        const existingColor = await prisma.color.findUnique({
            where: { id: parseInt(id) }
        });

        if (!existingColor) {
            res.status(404).json({ message: "Color not found" });
            return;
        }

        const { name } = value;
        await prisma.color.update({
            where: { id: parseInt(id) },
            data: { name }
        });

        res.status(200).json({ message: "Color updated successfully" });
    } catch (err) {
        res.status(500).json({ message: "Server error occurred" });
    }
}

export async function deleteColor(req: Request, res: Response) {
    try {
        const { id } = req.params;

        const existingColor = await prisma.color.findUnique({
            where: { id: parseInt(id) }
        });

        if (!existingColor) {
            res.status(404).json({ message: "Color not found" });
            return;
        }

        await prisma.color.delete({
            where: { id: parseInt(id) }
        });

        res.status(200).json({ message: "Color deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: "Server error occurred" });
    }
}