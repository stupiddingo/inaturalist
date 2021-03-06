import React, { PropTypes } from "react";
import ReactDOM from "react-dom";
import _ from "lodash";
import c3 from "c3";
import moment from "moment";

class Charts extends React.Component {
  constructor( ) {
    super( );
    this.defaultC3Config = {
      data: {
        colors: {
          verifiable: "#dddddd",
          research: "#74ac00"
        },
        types: {
          verifiable: "line",
          research: "area"
        },
        // For some reason this is necessary to enable the cursor style on the points
        selection: {
          enabled: true
        }
      },
      axis: {
        y: {
          min: 0,
          show: true,
          padding: {
            left: 0,
            bottom: 0
          },
          tick: {
            outer: false,
            format: d => I18n.toNumber( d, { precision: 0 } )
          }
        }
      },
      legend: {
        show: false
      },
      point: {
        r: 3,
        focus: {
          expand: {
            r: 4
          }
        }
      }
    };
  }
  componentDidMount( ) {
    const domNode = ReactDOM.findDOMNode( this );
    this.renderSeasonalityChart( );
    $( "a[data-toggle=tab]", domNode ).on( "shown.bs.tab", e => {
      switch ( e.target.hash ) {
        case "#charts-seasonality":
          if ( !this.props.monthOfYearFrequency || !this.props.monthOfYearFrequency.verifiable ) {
            this.props.fetchMonthOfYearFrequency( );
          }
          if ( this.seasonalityChart ) {
            this.seasonalityChart.flush( );
          }
          break;
        case "#charts-history":
          if ( !this.props.monthFrequency || !this.props.monthFrequency.verifiable ) {
            this.props.fetchMonthFrequency( );
          }
          if ( this.historyChart ) {
            this.historyChart.flush( );
          }
          break;
        default:
          // it's cool, you probably have what you need
      }
    } );
  }
  shouldComponentUpdate( ) {
    // You would think the following would work, but it doesn't. For some
    // reason there's never a point where nextProps and this.props are
    // different.
    // if (
    //   _.isEqual( nextProps.monthOfYearFrequency.verifiable, this.props.monthOfYearFrequency.verifiable )
    //   &&
    //   _.isEqual( nextProps.monthFrequency.verifiable, this.props.monthFrequency.verifiable )
    // ) {
    //   return false;
    // }
    return true;
  }
  componentDidUpdate( ) {
    if ( this.props.monthOfYearFrequency.verifiable ) {
      this.renderSeasonalityChart( );
    }
    if ( this.props.monthFrequency.verifiable ) {
      this.renderHistoryChart( );
    }
  }
  tooltipContent( d, defaultTitleFormat, defaultValueFormat, color, tipTitle ) {
    return `
      <div class="frequency-chart-tooltip">
        <div class="title">${tipTitle}</div>
        ${d.map( item => `
          <div class="series">
            <span class="swatch" style="background-color: ${color( item )}"></span>
            <span class="column-label">${item.name}:</span>
            <span class="value">${I18n.toNumber( item.value, { precision: 0 } )}</span>
          </div>
        ` ).join( "" )}
      </div>
    `;
  }
  renderSeasonalityChart( ) {
    const verifiableFrequency = this.props.monthOfYearFrequency.verifiable || {};
    const researchFrequency = this.props.monthOfYearFrequency.research || {};
    const keys = _.keys(
      verifiableFrequency
    ).map( k => parseInt( k, 0 ) ).sort( ( a, b ) => a - b );
    const that = this;
    const config = _.defaultsDeep( { }, this.defaultC3Config, {
      data: {
        columns: [
          ["verifiable", ...keys.map( i => verifiableFrequency[i.toString( )] || 0 )],
          ["research", ...keys.map( i => researchFrequency[i.toString( )] || 0 )]
        ],
        onclick: d => {
          that.seasonalityChart.unselect( ["verifiable", "research"] );
          that.props.openObservationsSearch( {
            month: d.x + 1
          } );
        }
      },
      axis: {
        x: {
          type: "category",
          categories: keys.map( i => I18n.t( "date.abbr_month_names" )[i].toUpperCase( ) )
        }
      },
      tooltip: {
        contents: ( d, defaultTitleFormat, defaultValueFormat, color ) => that.tooltipContent(
          d, defaultTitleFormat, defaultValueFormat, color,
          `${I18n.t( "observations_total" )}: ${I18n.t( "date.month_names" )[d[0].index + 1]}`
        )
      }
    } );
    const mountNode = $( ".SeasonalityChart", ReactDOM.findDOMNode( this ) ).get( 0 );
    this.seasonalityChart = c3.generate( Object.assign( { bindto: mountNode }, config ) );
  }
  renderHistoryChart( ) {
    const verifiableFrequency = this.props.monthFrequency.verifiable || {};
    const researchFrequency = this.props.monthFrequency.research || {};
    const dates = _.keys( verifiableFrequency ).sort( );
    const years = _.uniq( dates.map( d => new Date( d ).getFullYear( ) ) ).sort( );
    const chunks = _.chunk( years, 2 );
    const that = this;
    const regions = chunks.map( pair => (
      {
        start: `${pair[0]}-01-01`,
        end: `${pair[0] + 1}-01-01`
      }
    ) );
    const config = _.defaultsDeep( { }, this.defaultC3Config, {
      data: {
        x: "x",
        columns: [
          ["x", ...dates],
          ["verifiable", ...dates.map( d => verifiableFrequency[d] || 0 )],
          ["research", ...dates.map( d => researchFrequency[d] || 0 )]
        ],
        onclick: d => {
          this.props.openObservationsSearch( {
            quality_grade: ( d.name === "research" ? "research" : null ),
            year: d.x.getFullYear( ),
            month: d.x.getMonth( ) + 1
          } );
        }
      },
      axis: {
        x: {
          type: "timeseries",
          tick: {
            culling: true,
            values: years.map( y => `${y}-06-15` ),
            format: "%Y"
          },
          extent: [moment( ).subtract( 10, "years" ).toDate( ), new Date( )]
        }
      },
      zoom: {
        enabled: true,
        rescale: true
      },
      tooltip: {
        contents: ( d, defaultTitleFormat, defaultValueFormat, color ) => that.tooltipContent(
          d, defaultTitleFormat, defaultValueFormat, color,
          `${I18n.t( "observations_total" )}:
          ${I18n.t( "date.abbr_month_names" )[d[0].x.getMonth( ) + 1]}
          ${d[0].x.getFullYear( )}`
        )
      },
      regions
    } );
    const mountNode = $( ".HistoryChart", ReactDOM.findDOMNode( this ) ).get( 0 );
    this.historyChart = c3.generate( Object.assign( { bindto: mountNode }, config ) );
  }
  render( ) {
    return (
      <div id="charts" className="Charts">
        <ul className="nav nav-tabs" role="tablist">
          <li role="presentation" className="active">
            <a
              href="#charts-seasonality"
              aria-controls="charts-seasonality"
              role="tab"
              data-toggle="tab"
            >
              { I18n.t( "seasonality" ) }
            </a>
          </li>
          <li role="presentation">
            <a
              href="#charts-history"
              aria-controls="charts-history"
              role="tab"
              data-toggle="tab"
            >
              { I18n.t( "history" ) }
            </a>
          </li>
        </ul>
        <div className="tab-content">
          <div role="tabpanel" className="tab-pane active" id="charts-seasonality">
            <div
              className={
                `no-content text-muted text-center ${_.isEmpty( this.props.monthFrequency.verifiable ) ? "" : "hidden"}`
              }
            >
              { I18n.t( "no_observations_yet" ) }
            </div>
            <div className="SeasonalityChart FrequencyChart">
            </div>
          </div>
          <div role="tabpanel" className="tab-pane" id="charts-history">
            <div
              className={
                `no-content text-muted text-center ${_.isEmpty( this.props.monthFrequency.verifiable ) ? "" : "hidden"}`
              }
            >
              { I18n.t( "no_observations_yet" ) }
            </div>
            <div className="HistoryChart FrequencyChart"></div>
          </div>
        </div>
      </div>
    );
  }
}

Charts.propTypes = {
  monthOfYearFrequency: PropTypes.object,
  monthFrequency: PropTypes.object,
  fetchMonthOfYearFrequency: PropTypes.func,
  fetchMonthFrequency: PropTypes.func,
  openObservationsSearch: PropTypes.func
};

export default Charts;
