import { Request, Response } from 'express';
import BaseController from './base.controller';
import { productSchema } from '../helper/validate';
import { uploadSingleImage } from '../helper/uploadImage';
import logger from '../config/logger';
import { AddProductPayloadType } from '@types';
import shortUUID from 'short-uuid';
import prisma from '../config/prisma';

export default class ProductController extends BaseController {
  constructor() {
    super();
  }

  async publishProduct(req: Request, res: Response) {
    const productId = req.params.productId;

    // Find the product by ID
    const existingProduct = await prisma.product.findUnique({
      where: {
        id: productId,
      },
    });

    // Check if the product exists
    if (!existingProduct) {
      return this.error(res, '--product/not-found', 'Product not found', 404);
    }

    // Update the is_published field to true
    await prisma.product.update({
      where: {
        id: productId,
      },
      data: {
        is_published: true,
      },
    });

    this.success(res, '--publish/success', 'Product published successfully', 201);
  }

  async addProduct(req: Request, res: Response) {
    const file = req.file ?? null;
    const payload: AddProductPayloadType = JSON.parse(req.body.json);

    const { error, value } = productSchema.validate(payload);
    if (error || !file) {
      return this.error(res, '--product/invalid-fields', error?.message ?? 'product image is missing.', 400, null);
    }
    // upload image to cloudinary
    const { name, currency, userId, description, discountPrice, price, quantity, tax, category, shopId } = payload;
    const { isError, errorMsg, image } = await uploadSingleImage(file);

    if (isError) {
      logger.error(`Error uploading image: ${errorMsg}`);
    }

    // check if user has a shop
    const shopExists = await prisma.shop.findFirst({
      where: {
        id: shopId,
      },
    });

    if (!shopExists) {
      return this.error(res, '--product/shop-notfound', 'Failed to crete product, shop not found.', 404);
    }

    // check if user exists

    const placeHolderImg = image ?? 'https://placehold.co/600x400/EEE/31343C?text=placeholder';
    const product = await prisma.product.create({
      data: {
        id: shortUUID.generate(),
        name,
        shop_id: shopId,
        user_id: userId,
        currency,
        description,
        discount_price: discountPrice ?? 0,
        quantity,
        price,
        tax: tax ?? 0,
        categories: {
          create: {
            name: category,
          },
        },
        image: {
          create: {
            url: placeHolderImg,
          },
        },
      },
    });

    this.success(res, 'Product Added', 'Product has been added successfully', 201, product);
  }

  async addProductDraft(req: Request, res: Response) {
    const file = req.file ?? null;
    const payload: AddProductPayloadType = JSON.parse(req.body.json);

    const { error, value } = productSchema.validate(payload);
    if (error) {
      return this.error(
        res,
        '--product/invalid-fields',
        error?.message ?? 'Important product details is missing.',
        400,
        null
      );
    }

    // upload image to cloudinary
    const { name, currency, description, discountPrice, price, quantity, tax, category, shopId, userId } = payload;
    const { isError, errorMsg, image } = await uploadSingleImage(file);

    if (isError) {
      logger.error(`Error uploading image: ${errorMsg}`);
    }

    const placeHolderImg = image ?? 'https://placehold.co/600x400/EEE/31343C?text=placeholder';
    const productId = shortUUID.generate();
    const product = await prisma.product.create({
      data: {
        id: productId,
        name,
        shop_id: shopId,
        user_id: userId,
        currency,
        description,
        discount_price: discountPrice ?? 0,
        quantity,
        price,
        tax: tax ?? 0,
        categories: {
          create: {
            name: category,
          },
        },
        image: {
          create: {
            url: placeHolderImg,
          },
        },
      },
    });

    // product Id is returned back incase they try re-saving it as draft
    // but I think the usual method is redirecting the user back to a page
    // after saving as draft so they don't have to click on the save-as-draft
    // button twice.

    this.success(res, '--product/save-as-draft', 'Product updated and saved as draft', 201, { productId });
  }

  async unpublishProduct(req: Request, res: Response) {
    const productId = req.params.productId;

    //check if product exists
    const prodExists = await prisma.product.findFirst({ where: { id: productId } });

    if (!prodExists) {
      return this.error(res, '--product/notfound', 'Failed to unpublish, product not found', 404);
    }

    // Update the is_published field to false
    const updatedProduct = await prisma.product.update({
      where: {
        id: productId,
      },
      data: {
        is_published: false,
      },
    });

    this.success(res, 'Product Unpublished', 'Product has been unpublished successfully', 201, updatedProduct);
  }
}
