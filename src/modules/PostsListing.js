import React, { Component } from 'react';
import { Link, graphql, StaticQuery } from 'gatsby'
import './PostListing.css'
import truncate from 'truncate-html'

export default props => (
    <StaticQuery
        query={graphql`
        query PostListingModuleQuery {
            allAgilityContent(
              filter: {
                properties: { referenceName: { eq: "posts"}}
              },
              limit: 10
            ) {
              totalCount
              nodes {
                contentID
                agilityFields {
                    title
                    details
                    image {
                        url
                    }
                }
                    properties {
                        referenceName
                    }
                }
            }
            allAgilitySitemap (
              filter: {
                contentID: {ne: -1}
              }
                ){
              nodes {
                contentID,
                path
              }
            }
          }
        `}
        render={queryData => {

            let posts = [];

            //get the dynamic URLs for each post
            queryData.allAgilityContent.nodes.forEach(post => {


                const sitemapNodeForPost = queryData.allAgilitySitemap.nodes.find(sitemapNode => {
                    return post.contentID === sitemapNode.contentID;
                })



                post.dynamicUrl = sitemapNodeForPost.path;
                posts.push(post);
            })

            const viewModel = {
                item: props.item,
                posts: posts
            }
            return (
                <PostsListing {...viewModel} />
            );
        }}
    />
)


class PostsListing extends Component {
    renderPostExcerpt(html) {
        const excerpt = truncate(html, { stripTags: true, length: 160 });
        return { __html: excerpt };
    }
    renderPosts() {
        if (this.props.posts != null) {
            let posts = [];

            this.props.posts.forEach(post => {
                posts.push(
                    <div className="post" key={post.contentID}>
                        {post.agilityFields.image &&
                            <img src={post.agilityFields.image.url + '?w=860'} alt={post.agilityFields.image.label} />
                        }
                        <h2>
                            <Link to={post.dynamicUrl}>{post.agilityFields.title}</Link>
                        </h2>
                        <p dangerouslySetInnerHTML={this.renderPostExcerpt(post.agilityFields.details)}></p>
                    </div>
                )
            })

            return posts;
        }
    }
    render() {

        return (


            < section className="posts-listing" >
                <div className="container">
                    <h1>{this.props.item.agilityFields.title}</h1>
                    {this.renderPosts()}
                </div>
            </section >
        );
    }
}
