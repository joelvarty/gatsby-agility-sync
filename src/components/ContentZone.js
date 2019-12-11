import React, { Component } from 'react';

export default class ContentZone extends Component {
    renderModules = () => {
        let modules = []


        const contentZoneName = this.props.name;
        const modulesForThisContentZone = this.props.pageContext.page.zones[contentZoneName];

        if (modulesForThisContentZone === undefined) {
            console.error(`Cannot render modules for zone "${contentZoneName}". This does not appear to be a valid content zone for this page template.`)
            return;
        }

        modulesForThisContentZone.forEach(moduleItem => {

            const ModuleComponentToRender = this.props.modules[moduleItem.properties.definitionName];
            const moduleProps = {
                key: moduleItem.contentID,
                dynamicPageItem: this.props.pageContext.dynamicPageItem,
                item: moduleItem
            }


            if (ModuleComponentToRender) {
                modules.push(<ModuleComponentToRender {...moduleProps} />)
            } else {
                console.error(`No react component found for the module "${moduleItem.module}". Cannot render module.`);
            }
        })

        return modules;
    }

    render() {
        return (
            <div className="content-zone">
                {this.renderModules()}
            </div>
        );
    }
}