import Joi from "joi"
export const validateSchema = {
    idField : function (fieldName : string) {
        return Joi.number().required().messages({'any.required' : `Please specify ${fieldName}`, 'number.base' : `Please specify ${fieldName}`})
    }, 
    nameField : function (fieldName : string){
        return Joi.string().required().messages({'any.required' : `Please specify ${fieldName}`, 'number.base' : `Please specify ${fieldName}`})
    }, 
    allowZeroQuantity : function(){
        return Joi.number().min(0).required().messages({'any.required' : `Quantity must be equal or greater than 0`, 'number.base' : `Quantity must be equal or greater than 0`, 'number.min' : `Quantity must be equal or greater than 0`})
    }, 
    quantity : function(){
        return Joi.number().min(1).required().messages({'any.required' : `Quantity must be equal or greater than 1`, 'number.base' : `Quantity must be equal or greater than 1`, 'number.min' : `Quantity must be equal or greater than 1`})
    },
    cost : function () {
        return Joi.number().precision(2).min(0).messages({ 'number.min' : 'Cost price must be equal or greater than 0', 'number.precision' : "Invalid cost price", 'any.required' : "Cost price required", 'number.base' : 'Invalid cost price'})
    }, 
    arrayField : function (fieldName : string){
        return Joi.array().min(1).required().messages({'array.base' : `Please select at least one ${fieldName}`, 'any.required' : `Please select at least one ${fieldName}`, 'array.min' : `Please select at least one ${fieldName}`})

    }, 
    dateField : function (fieldName : string){
        return Joi.date().default(new Date()).messages({'any.required' : `Please specify a ${fieldName}`})
    }
}