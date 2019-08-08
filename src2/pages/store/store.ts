import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams, ModalController, LoadingController } from 'ionic-angular';

import '../../utils/linqtsExtension';

import { StoreProvider } from '../../providers/store/store';
import { ProductProvider } from '../../providers/Product/product';
import { AnalyticsProvider } from '../../providers/analytics/analytics';
import { StoreApi } from '../../models/Api/Store';
import { ProductApi } from '../../models/api/Product';
import { CartProvider } from '../../providers/Cart/cart';
import { CartViewModel } from '../../models/ViewModels/CartViewModel';
import { StoreViewModel } from '../../models/ViewModels/StoreViewModel';
import { OfferApi } from '../../models/Api/Offer';
import { OfferProvider } from '../../providers/Offer/offer';
import { OfferViewModel } from '../../models/ViewModels/OfferViewModel';
import { OfferGroupViewModel } from '../../models/ViewModels/OfferGroupViewModel';
import { ProductViewModel } from '../../models/ViewModels/ProductViewModel';
import { Product_AttributeGroupViewModel } from '../../models/ViewModels/Product_AttributeGroupViewModel';
import { Product_AttributeViewModel } from '../../models/ViewModels/Product_AttributeViewModel';
import { Product_IngredientViewModel } from '../../models/ViewModels/Product_IngredientViewModel';
import { Product_AttributeApi } from '../../models/Api/Product_Attribute';
import { Product_IngredientApi } from '../../models/Api/Product_Ingredient';
import { CategoryViewModel } from '../../models/ViewModels/CategoryViewModel';

@IonicPage({
	name: 'StorePage',
	segment: 'store/:storeSlug',
	defaultHistory: ['StoresPage']
})
@Component({
	selector: 'page-store',
	templateUrl: 'store.html',
})
export class StorePage {
	storeSegment: string = "catalog";
	store: StoreViewModel;
	deals: OfferViewModel[];
	liveDeals: OfferViewModel[];
	categories: CategoryViewModel[];
	categoryDeal: { open: boolean };
	cart: CartViewModel;

	constructor(public navCtrl: NavController, public modalCtrl: ModalController, public navParams: NavParams, public storeProvider: StoreProvider, public productProvider: ProductProvider, public offerProvider: OfferProvider, public loadingCtrl: LoadingController, public cartProvider: CartProvider, private analyticsProvider: AnalyticsProvider) {
		this.store = new StoreViewModel({ cover: "", minOrderCost: 0 });
	}

	ionViewDidEnter() {
		var storeSlug = this.navParams.get('storeSlug');
		this.analyticsProvider.trackView("/store/" + storeSlug);
	}

	async ionViewDidLoad(): Promise<void> {
		let loader = this.loadingCtrl.create({
			content: "Φόρτωση καταστήματος"
		});
		loader.present();

		var storeSlug = this.navParams.get('storeSlug');
		let store: StoreApi = await this.initializeStore(storeSlug);

		await Promise.all([
			this.initializeOffers(store.bid),
			this.initializeProducts(store.bid),
			this.initializeCart(store.bid),
		]);

		loader.dismiss();
	}

	async ionViewWillEnter(): Promise<void> {
		await this.initializeCart(this.store.bid);
	}

	initializeOffers(storeBid: number): Promise<void> {
		this.categoryDeal = { open: false };
		this.offerProvider.findDeals(storeBid, (offers: OfferApi[]) => {
			this.deals = offers.map(a => new OfferViewModel({
				...a,
				OfferGroups: a.OfferGroups.map(b => new OfferGroupViewModel({
					...b,
					Offer: undefined,
					Products: b.Products.map(c => new ProductViewModel({
						...c,
						Product_AttributeGroups: c.Product_AttributeGroups.map(d => new Product_AttributeGroupViewModel({
							...d,
							Product: null,
							Product_Attributes: d.Product_Attributes.sort(this.sortAttributes).map(e => new Product_AttributeViewModel({
								...e,
								Product_AttributeGroup: null
							})),
						})),
						Product_Ingredients: c.Product_Ingredients.sort(this.sortIngredients).map(d => new Product_IngredientViewModel({
							...d,
							Product: null,
						})),
					}))
				})),
			}));
		});
		
		this.offerProvider.findLiveDeals(storeBid, (offers: OfferApi[]) => {
			this.liveDeals = offers.map(a => new OfferViewModel({
				...a,
				OfferGroups: a.OfferGroups.map(b => new OfferGroupViewModel({
					...b,
					Offer: undefined,
					Products: b.Products.map(c => new ProductViewModel({
						...c,
						Product_AttributeGroups: c.Product_AttributeGroups.map(d => new Product_AttributeGroupViewModel({
							...d,
							Product: null,
							Product_Attributes: d.Product_Attributes.sort(this.sortAttributes).map(e => new Product_AttributeViewModel({
								...e,
								Product_AttributeGroup: null
							})),
						})),
						Product_Ingredients: c.Product_Ingredients.sort(this.sortIngredients).map(d => new Product_IngredientViewModel({
							...d,
							Product: null,
						})),
					}))
				})),
			}));
		});
		return;
	}

	initializeProducts(storeBid: number): Promise<void> {
		return this.productProvider.findByStoreBid(storeBid).toPromise().then((p: ProductApi[]) => {
			var products = p.ToList();
			products = products.Where(a => a.isActive);
			products = products.Where(a => a.Product_Tags.filter(b => b.level === 2 || b.level === 3).length > 0);
			products = products.OrderBy(a => a.orderNumber);
			var categories = products.GroupBy(a =>
				a.Product_Tags
					.filter(b => b.level === 2 || b.level === 3)
					.sort(b => b.level === 3 ? 1 : b.level === 2 ? -1 : 0)[0].Tag.name, b => b
			);
			console.log(categories);
			this.categories = Object.keys(categories).map((tagName: string) => {
				let category = categories[tagName].sort(this.sortProducts).map((a: ProductApi) => new ProductViewModel({
					...a,
					OfferGroups: null,
					Product_AttributeGroups: a.Product_AttributeGroups.map(d => new Product_AttributeGroupViewModel({
						...d,
						Product: null,
						Product_Attributes: d.Product_Attributes.sort(this.sortAttributes).map(e => new Product_AttributeViewModel({
							...e,
							Product_AttributeGroup: null
						})),
					})),
					Product_Ingredients: a.Product_Ingredients.sort(this.sortIngredients).map(d => new Product_IngredientViewModel({
						...d,
						Product: null,
					})),
				}));
				category.key = tagName;
				return category;
			});
			console.log(this.categories);
		});
	}

	async initializeStore(storeSlug: string): Promise<StoreApi> {
		let store = await this.storeProvider.findBySlug(storeSlug);
		this.store = new StoreViewModel({ ...store });
		return store;
	}

	initializeCart(storeBid: number): Promise<void> {
		return this.cartProvider.getByStoreBid(storeBid).then((cart: CartViewModel) => {
			this.cart = cart;
		});
	}

	toggleSection(i: number) {
		this.categories[i].open = !this.categories[i].open;
	}

	toggleSectionDeal() {
		this.categoryDeal.open = !this.categoryDeal.open;
	}

	getBackgroundStyle(imagepath: string) {
		return {
			'background-image': 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.7) 80%), url(' + imagepath + ')',
			'background-position': 'center center',
			'background-size': 'cover',
		};
	}

	openModal(product: ProductApi) {
		let productModal = this.modalCtrl.create('ProductModalPage', { storeBid: this.store.bid, product: product });
		productModal.onDidDismiss(this.onProductModalDidDismiss.bind(this));
		productModal.present();
	}

	async onProductModalDidDismiss(data: any): Promise<void> {
		if (!data.isAdded)
			return;

		let loader = this.loadingCtrl.create({
			content: "Φόρτωση καταστήματος"
		});
		loader.present();

		var storeBid = this.store.bid;

		await Promise.all([
			this.initializeOffers(storeBid),
			this.initializeProducts(storeBid),
			this.initializeCart(storeBid),
		]);

		loader.dismiss();
	}

	openOfferModal(offer: OfferApi) {
		let offerModal = this.modalCtrl.create('OfferModalPage', { storeBid: this.store.bid, offer: offer });
		offerModal.onDidDismiss(this.onOfferModalDidDismiss.bind(this));
		offerModal.present();
	}

	async onOfferModalDidDismiss(data: any): Promise<void> {
		if (!data.isAdded)
			return;

		let loader = this.loadingCtrl.create({
			content: "Φόρτωση καταστήματος"
		});
		loader.present();

		var storeBid = this.store.bid;

		await Promise.all([
			this.initializeOffers(storeBid),
			this.initializeProducts(storeBid),
			this.initializeCart(storeBid),
		]);

		loader.dismiss();
	}

	navigateToCheckoutPage() {
		this.navCtrl.push('CheckoutPage', { storeSlug: this.store.slug });
	}

	getAmountOfCartProducts(cart: CartViewModel): number {
		var items: number = cart.cartItems.reduce((a, b) => a + b.quantity, 0);
		var itemOffers: number = cart.cartItemOffers.reduce((a, b) => a + b.products.reduce((a, b) => a + b.quantity, 0), 0);

		return items + itemOffers;
	}


	sortProducts(a: ProductApi, b: ProductApi): number {
		return a.orderNumber === null || (b.orderNumber !== null && a.orderNumber > b.orderNumber) ? 1 : -1
	}

	sortIngredients(a: Product_IngredientApi, b: Product_IngredientApi): number {
		var sumA = (!a.isDefault ? 4 : 0) + (!a.orderNumber ? 2 : 0) + (Number(a.orderNumber) > Number(b.orderNumber) ? 1 : 0);
		var sumB = (!b.isDefault ? 4 : 0) + (!b.orderNumber ? 2 : 0) + (Number(b.orderNumber) > Number(a.orderNumber) ? 1 : 0);
	
		return sumA > sumB ? 1 : (sumA < sumB ? -1 : 0);
	}
	
	sortAttributes(a: Product_AttributeApi, b: Product_AttributeApi): number {	
		var sumA = (!a.isDefault ? 4 : 0) + (!a.orderNumber ? 2 : 0) + (Number(a.orderNumber) > Number(b.orderNumber) ? 1 : 0);
		var sumB = (!b.isDefault ? 4 : 0) + (!b.orderNumber ? 2 : 0) + (Number(b.orderNumber) > Number(a.orderNumber) ? 1 : 0);
	
		return sumA > sumB ? 1 : (sumA < sumB ? -1 : 0);
	}
}