// English.
import type { Dictionary } from "../types";

export const en: Dictionary = {
  // App
  "app.connectError.title": "Couldn't open the app",
  "app.connectError.message": "Open Atacarejo from the Tiendanube admin, under My apps.",

  // ErrorState
  "errorState.title": "Couldn't load the information",
  "errorState.message": "This may be a temporary issue. Please try again in a few moments.",
  "errorState.retry": "Try again",
  "errorState.support": "If the problem persists, contact us:",

  // HomePage
  "home.title": "Set wholesale prices",
  "home.subtitle.withMin": "The discount applies when the cart has {count} or more units with a wholesale price.",
  "home.subtitle.noMin": "The discount applies when the cart reaches the minimum wholesale quantity.",
  "home.configure": "Settings",
  "home.save": "Save",
  "home.saveCount": "Save ({count})",
  "home.search.label": "Search products",
  "home.search.placeholder": "Search by name or SKU",
  "home.setupPending.title": "Setup isn't complete",
  "home.setupPending.text":
    "The wholesale promotion hasn't been created in your store yet, so the discount doesn't show up in the cart.",
  "home.setupPending.action": "Complete setup",
  "home.onboarding.title": "Start by setting wholesale prices",
  "home.onboarding.text":
    "Enter the wholesale price for the variants you want to sell wholesale and click Save. When the cart has {count} or more units of these products, the discount is applied automatically, no coupon needed.",
  "home.invalidPrice":
    "Use numbers only, with up to 2 decimal places, such as {example}. To remove the wholesale price, leave the field empty.",
  "home.empty.search.title": "No products found",
  "home.empty.search.text": "Check your search term or clear the search to see all products.",
  "home.empty.search.action": "Clear search",
  "home.empty.store.title": "Your store doesn't have any products yet",
  "home.empty.store.text": "Add products in the Tiendanube admin and come back here to set wholesale prices.",
  "home.empty.store.action": "Add product",
  "home.table.product": "Product",
  "home.table.variant": "Variant",
  "home.table.price": "Price",
  "home.table.wholesalePrice": "Wholesale price",
  "home.applyToAll": "Apply to all variants",
  "home.priceInput.label": "Wholesale price for {product} {variant}",
  "home.toast.saved": "Wholesale prices saved",
  "home.toast.saveError": "Couldn't save the prices",
  "home.toast.setupOk": "Setup complete",
  "home.toast.setupError": "Couldn't complete the setup. Please try again in a few moments.",
  "home.leave.title": "Leave without saving?",
  "home.leave.message.one": "You have {count} price change that hasn't been saved yet.",
  "home.leave.message.other": "You have {count} price changes that haven't been saved yet.",
  "home.leave.keepEditing": "Keep editing",
  "home.leave.confirm": "Leave without saving",

  // ConfigPage
  "config.backLink": "Wholesale prices",
  "config.title": "Wholesale settings",
  "config.save": "Save",
  "config.minQuantity.title": "Minimum quantity",
  "config.minQuantity.text":
    "The wholesale price applies when the cart has this many units, counting only products that have a wholesale price. Products without a wholesale price keep their regular price.",
  "config.minQuantity.label": "Units in the cart",
  "config.minQuantity.help": "E.g., with 3, the discount applies from 3 units.",
  "config.minQuantity.invalid": "Use a whole number from {min} to {max}.",
  "config.design.title": "Display style",
  "config.design.text": "Choose how the wholesale price is shown to customers in your store.",
  "config.toast.saved": "Settings saved",
  "config.toast.saveError": "Couldn't save",

  // Display styles
  "design.1.title": "Standard",
  "design.1.description": "Current display of the wholesale price in the store.",

  // API errors
  "apiError.invalidDesignOption": "The selected display style isn't available.",
  "apiError.invalidMinQuantity": "The minimum quantity must be a whole number from 1 to 999.",
  "apiError.invalidPrice": "One of the prices is invalid. Use numbers only, with up to 2 decimal places.",
  "apiError.storeNotInstalled":
    "The app isn't installed in this store. Reinstall Atacarejo from the Tiendanube admin.",
  "apiError.rateLimited": "Too many requests in a short time. Please try again in a few moments.",
  "apiError.nuvemshopUnavailable": "Tiendanube didn't respond. Please try again in a few moments.",
  "apiError.invalidToken": "Access to the store has expired. Reinstall the app from the Tiendanube admin.",
  "apiError.badRequest": "Some of the data is invalid. Please review it and try again.",
  "apiError.unauthorized": "We couldn't verify your access. Reinstall the app from the Tiendanube admin.",
  "apiError.server": "Something went wrong on the server. Please try again in a few moments.",
};
