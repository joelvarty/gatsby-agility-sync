import React, { Component } from 'react';
import { graphql } from "gatsby"
import { Helmet } from "react-helmet"

import Layout from "./Layout"
import PreviewBar from "../components/PreviewBar"

//You need to pass-down the available modules to the app because they will be rendered dynamically
import modules from '../modules/_allModules.js'
import pageTemplates from './_allPageTemplates.js'

import GlobalHeader from '../components/GlobalHeader'
import GlobalFooter from '../components/GlobalFooter'

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

        const contentID = this.props.pageContext.contentID;

        const pageJSON = this.props.data.agilityPage.internal.content;
        const page = JSON.parse(pageJSON);
        const title = this.props.pageContext.title;
        const isPreview = this.props.pageContext.isPreview;



        let dynamicPageItem = null;
        if (contentID > 0) {
            if (this.props.data.agilityContent && this.props.data.agilityContent.internal.content) {
                const contentJSON = this.props.data.agilityContent.internal.content;
                dynamicPageItem = JSON.parse(contentJSON);

            }
        }

        // //get the page template name that we need to render
        const pageTemplateName = page.templateName.replace(/[^0-9a-zA-Z]/g, '');

        // //build the  props
        const propsForPageTemplate = {
            page: page,
            dynamicPageItem: dynamicPageItem,
            modules: modules
        }
        const PageTemplateComponentToRender = pageTemplates[pageTemplateName];

        return (
            <Layout>
                <Helmet>
                    <meta charSet="utf-8" />
                    <title>{title} - Example Template</title>
                    <meta name="description" content={page.seo.metaDescription} />
                </Helmet>

                <PreviewBar isPreview={isPreview} />
                <GlobalHeader />
                <main className="main">
                    <PageTemplateComponentToRender {...propsForPageTemplate} />
                </main>
                <GlobalFooter />

            </Layout>
        );
    }
}


