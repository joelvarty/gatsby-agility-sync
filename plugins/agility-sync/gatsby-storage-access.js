class GatsbyStorageAccess {

	constructor({ getNode, createNodeId, createNode, createContentDigest, deleteNode }) {
		this.getNode = getNode;
		this.createNode = createNode;
		this.createNodeId = createNodeId;
		this.deleteNode = deleteNode;
		this.createContentDigest = createContentDigest;

	}


	getNodeID({ itemType, languageCode, itemID }) {
		const preStr = `agility${languageCode}-${itemType}-${itemID}`.toLowerCase();

		return this.createNodeId(preStr);
	}


	async saveItem({ item, itemType, languageCode, itemID }) {

		const nodeID = this.getNodeID({ itemType, languageCode, itemID });
		let typeName = `agility${itemType}`;

		const jsonContent = JSON.stringify(item);
		const nodeMeta = {
			id: nodeID,
			parent: null,
			children: [],
			internal: {
				type: typeName,
				content: jsonContent,
				contentDigest: this.createContentDigest(item)
			}
		}

		let nodeObj = {
			languageCode: languageCode,
			itemID: itemID
		}

		switch (itemType) {
			case "item": {
				nodeObj.itemJson = "";
				break;
			}
			case "page": {
				nodeObj.pageJson = "";
				break;
			}
			case "state": {
				break;
			}
			case "sitemap": {
				break;
			}
			default: {
				//a content list...
				item.agilityFields = item.fields;
				delete item.fields;

				item.languageCode = languageCode;
				item.itemID = itemID;
				nodeObj = item;
			}

		}

		const nodeToCreate = Object.assign({}, nodeObj, nodeMeta);

		await this.createNode(nodeToCreate);
	}

	async mergeItemToList({ item, languageCode, itemID, referenceName }) {

		//save the item in a list based on the content definition name...
		const definitionName = item.properties.definitionName;

		await this.saveItem({ item: item, itemType: definitionName, languageCode, itemID });

	}

	async getItem({ itemType, languageCode, itemID }) {

		const nodeID = this.getNodeID({ itemType, languageCode, itemID });
		const node = await this.getNode(nodeID);
		if (node == null) return null;

		const json = node.internal.content;
		const item = JSON.parse(json);

		return item;
	}

	async clearItems() {
		//don't need to handle this - gatsby clear will do that for us...
	}
}

module.exports = {
	GatsbyStorageAccess
}
