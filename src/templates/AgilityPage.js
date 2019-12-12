import React, { Component } from 'react';
import { graphql } from "gatsby"
import './AgilityPage.css'

//You need to pass-down the available modules to the app because they will be rendered dynamically
import modules from '../modules/_allModules.js'
import pageTemplates from './_allPageTemplates.js'

import GlobalHeader from '../components/GlobalHeader.js'

export const query = graphql`
  query($pageID: Int!, $contentID: Int!, $languageCode: String!) {
    agilityPage(pageID: {eq: $pageID}, languageCode: {eq: $languageCode}) {
        id
        internal {
        content
        }
    }
    agilityContent(contentID: {eq: $contentID}, languageCode: {eq: $languageCode}) {
        internal {
        content
        }
        id
    }
}
  `

export default class AgilityPage extends Component {

    render() {


        const thisPath = this.props.path;
        const pageID = this.props.pageContext.pageID;
        const contentID = this.props.pageContext.contentID;

        const pageJSON = this.props.data.agilityPage.internal.content;
        const page = JSON.parse(pageJSON);

        let dynamicPageItem = null;
        if (contentID > 0) {
            const contentJSON = this.props.data.agilityContent.internal.content;
            dynamicPageItem = JSON.parse(contentJSON);
        }

        //HACK
        //get the page object from context
        // const page = this.props.pageContext;//.page;
        // console.log("page", page)
        // //get the page template name that we need to render
        const pageTemplateName = page.templateName.replace(/[^0-9a-zA-Z]/g, '');

        // //build the props
        const propsForPageTemplate = {
            page: page,
            dynamicPageItem: dynamicPageItem,
            modules: modules
        }
        const PageTemplateComponentToRender = pageTemplates[pageTemplateName];

        return (
            <div id="inner-body">
                <div>{page.title} -  {thisPath} - {pageID} - {contentID} - {pageTemplateName}</div>
                <GlobalHeader />
                <PageTemplateComponentToRender {...propsForPageTemplate} />
            </div>
        );
    }
}


