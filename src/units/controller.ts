import { Request, Response } from 'express'
import Joi from 'joi'
import { prisma } from "../lib/prisma";
import { validateSchema } from '../configs/schema';

// Validation schema
type Unit = {
  name : string; 
  symbol : string; 
  description : string; 
}
const unitSchema = Joi.object({
  name: validateSchema.nameField('Unit name'),
  symbol: Joi.string().required(),
  description: Joi.string().allow(''),
})

const updateUnitSchema = Joi.object({
  name: Joi.string(),
  description: Joi.string().allow(''),
  symbol: Joi.string()
}).min(1) // At least one field must be provided

// Functions
export async function addUnit(req : Request, res : Response) {
  try {
    const { error, value } = unitSchema.validate(req.body)
    if (error) {
        res.status(400).json({ error: error.details[0].message })
        return 
    }
    const { name, description, symbol } = value; 
    const unit = await prisma.unit.create({
      data: {
        name,
        description, 
        symbol
      }
    })
    res.status(201).json({ message : "Unit added successfully"})
    return 
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: 'Internal server error' })
    return 
  }
}

export async function getUnit(req : Request, res : Response) {
  try {
    const { id } = req.params
    
    const unit = await prisma.unit.findUnique({
      where: { id: parseInt(id) },
      include: {
        rawMaterials: true,
        products: true
      }
    })
    
    if (!unit) {
        res.status(404).json({ error: 'Unit not found' })
        return 
    }
    
    res.status(200).json(unit)
    return 
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
    return 
  }
}

export async function getUnits(req : Request, res : Response) {
  try {
    const units = await prisma.unit.findMany({
      include: {
        rawMaterials: true,
        products: true
      }
    })
    
    res.status(200).json(units)
    return 
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
    return 
  }
}

export async function updateUnit(req : Request, res : Response) {
  try {
    const { id } = req.params
    const { error, value } = updateUnitSchema.validate(req.body)
    if (error){ 
        res.status(400).json({ error: error.details[0].message })
        return 
    }
    const unit = await prisma.unit.update({
      where: { id: parseInt(id) },
      data: value
    })
    
    res.status(200).json(unit)
    return 
  } catch (error:any) {
    if (error.code === 'P2025') {
        res.status(404).json({ error: 'Unit not found' })
      return 
    }
    res.status(500).json({ error: 'Internal server error' })
    return 
  }
}

export async function deleteUnit(req : Request, res : Response) {
  try {
    const { id } = req.params

    await prisma.unit.delete({
      where: { id: parseInt(id) }
    })
    res.status(204).send()
    return 
  } catch (error:any) {
    if (error.code === 'P2025') {
    res.status(404).json({ error: 'Unit not found' })
      return 
    }
    res.status(500).json({ error: 'Internal server error' })
    return 
  }
}